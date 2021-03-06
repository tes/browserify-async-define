var path = require('path');
var browserify = require('browserify');
var temp = require('temp');
var through = require('through2');
var fs = require('fs');
var mkdirp = require('mkdirp');
var transformer = require('./transformer');
var utils = require('./utilities');
var quote = utils.quote;
var mangleName = utils.mangleName;
var bundleCollapser = require('bundle-collapser/plugin');
var adPathName = require.resolve('async-define');

temp.track(); // remove temp files

function getDeps(dependsOn){
  var names = Object.keys(dependsOn);
  var labels = names.map(function (k){return dependsOn[k];});
  var args = names.map(mangleName);
  return {deps: labels, args: args};
}

function getExports(exports){
  return Object.keys(exports)
    .map(function (f){
      var cwd = process.cwd();
      var key = path.join(cwd, f);
      var value = exports[f];
      return [key, value];
    })
    .reduce(function (previous, current){
      previous[current[0]] = current[1];
      return previous;
    }, {});
}

function strArray2tuples(a) {
  return a.map(function (item){
    var items = item.split(':');
    return items.length >= 2 ? items : [item, item];
  });
}

function tuples2objects(t) {
  return t.reduce(function (previous, tuple){
    previous[tuple[0]] = tuple[1];
    return previous;
  }, {});
}

function array2obj(a) {
  return tuples2objects(strArray2tuples(a));
}

function getFileMap(t){
  return t.filter(function (tuples){
    return tuples.length >= 3;
  })
  .reduce(function (obj, tuples){
    var filename = tuples[2];
    if (filename in obj){
      obj[filename].push(tuples);
    }
    else {
      obj[filename] = [tuples];
    }
    return obj;
  }, {});
}

function deps2Bundle(d){
  var requires = d.map(function (t){
    var label = t[1];
    var name = t[0];
    return "var " + mangleName(name) + " = require(" + quote(name) + ");"
  })
  .join('\n');

  var defines = d.map(function (t){
    var label = t[1];
    var name = t[0];
    return "require('" + adPathName + "')(" + quote(label) + ", function(){return " + mangleName(name) + ";});"
  })
  .join('\n');

  return [requires, defines].join('\n');
}

function fileMap2Bundles(m){
  return Object.keys(m).map(function (filename){
    return [filename, deps2Bundle(m[filename])];
  });
}

function bundlesToVirtualFiles(b, callback){
  b.forEach(function (bundle){
    temp.open('myprefix', function(err, info) {
      if (err) {
        return callback(err);
      }
      fs.write(info.fd, bundle[1], function (err){
        if (err) {
          return callback(err);
        }
        fs.close(info.fd, function(err) {
          callback(null, info.path, bundle[0]);
        });
      });
    });
  });
}

function arrayfy(arg){
  return typeof arg === "string" ? [arg] : arg;
}

function getOptions(o) {
  // expecting o.d or o.dependsOn and o.e or o.exports
  var out = {};
  out.dependsOn = arrayfy("d" in o ? o.d : "dependsOn" in o ? o.dependsOn : []);
  out.exports = arrayfy("e" in o ? o.e : "exports" in o ? o.exports : []);
  return out;
}

module.exports = function (b, opts) {
  var o = getOptions(opts);
  var exports = getExports(array2obj(o.exports));
  var depsObj = array2obj(o.dependsOn);
  var deps = getDeps(depsObj);
  var depsTuples = strArray2tuples(o.dependsOn);
  var fileLookupTable = depsTuples.map(function (t){
    return [t[0], t[2]];
  })
  .reduce(function (obj, value){
    if (value[1]) {
      obj[value[0]] = value[1];
    }
    return obj;
  }, {});

  var removedDependencies = {};
  var removedDependenciesOnCurrentFile = {};

  b.transform(transformer.requireTransform, {
    verbose: !!opts.verbose,
    depsObj: depsObj,
    removedDependencies: removedDependencies,
    removedDependenciesOnCurrentFile: removedDependenciesOnCurrentFile,
    global: true
  });

  b.transform(transformer.wrapTransform, {
    exports: exports,
    deps: deps,
    removedDependencies: removedDependencies,
    removedDependenciesOnCurrentFile: removedDependenciesOnCurrentFile,
    global: true
  });

  var onEnd = function (next){
    var additional = Object.keys(removedDependencies).map(function (key){
      return [key,
        removedDependencies[key].label + key.slice(removedDependencies[key].name.length),
        fileLookupTable[removedDependencies[key].name]]
    });
    depsTuples = depsTuples.concat(additional);
    var fileMap = getFileMap(depsTuples);
    var files = fileMap2Bundles(fileMap);

    if (opts.verbose) {
      console.log('')
      console.log('Building Common bundles:')
      Object.keys(fileMap).forEach(f => {
        console.log('')
        console.log(`File: ${f}`);
        fileMap[f].forEach( t => {
          console.log(`* Dep: ${t[0]} - Label: ${t[1]}`);
        });
      });
    }

    var streamNumber = Object.keys(fileMap).length;

    bundlesToVirtualFiles(files, function (err, f, bundlePath){
      if (err) {
        console.log(err);
        return;
      }
      var b = browserify(f, {basedir: process.cwd(), paths: ['./node_modules']});

      if(opts.collapse) {
        b.plugin(bundleCollapser);
      }
      var writableStream = fs.createWriteStream(bundlePath);
      mkdirp.sync(path.dirname(bundlePath));
      b.bundle().pipe(writableStream);
      writableStream.on('finish', function (){
        streamNumber--;
        if (streamNumber === 0){
          next();
        }
      });
    });
  };

  b.pipeline.get('label').push(through.obj(function(row, enc, next) {
    next(null, row);
  },
  function (cb){
    if (Object.keys(fileLookupTable).length) {
      onEnd(cb);
    }
    else {
      cb();
    }
  }));
  if(opts.collapse) {
    b.plugin(bundleCollapser);
  }
}
