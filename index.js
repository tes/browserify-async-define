var path = require('path');
var falafel = require('falafel');
var transformTools = require('browserify-transform-tools');
var browserify = require('browserify');
var temp = require('temp');
var fs = require('fs');
var mkdirp = require('mkdirp');

temp.track(); // remove temp files

function mangleName(n){
  return "__" + n.replace(/[\-./.]/g, '_');
}

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

function quote(item){
  return '"' + item + '"';
}

function wrap(exports, deps, sym, body){
  var d = '[' + deps.deps.map(quote).join(',') + '],';
  var a = deps.args.join(',');
  var s = sym ? quote(sym) + "," : "";
  var out = ["var asyncDefine = require('async-define');"];
  out.push("asyncDefine(" + s + d + "function (" + a + "){" );
  out.push(body);
  if (sym){  
    out.push("return module.exports;");
  }
  out.push("});");

  return out.join("\n");
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
    return "asyncDefine(" + quote(label) + ", function(){return " + mangleName(name) + ";});"
  })
  .join('\n');
  
  return ["var asyncDefine = require('async-define');", requires, defines].join('\n');
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

var options = {excludeExtensions: [".json"]};
var stringTransform = transformTools.makeStringTransform("browserify-async-define", options,
  function (content, transformOptions, done) {
    var o = getOptions(transformOptions.config);
    var exports = getExports(array2obj(o.exports));
    var depsObj = array2obj(o.dependsOn);
    var deps = getDeps(depsObj);
    var file = transformOptions.file;

    var newContent = (deps.deps.length > 0 || file in exports) ? wrap(exports, deps, exports[file], content) : content
    var output = falafel(newContent, function (node) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require'){
        var dirname = path.dirname(transformOptions.file);
        var varNames = ['__filename', '__dirname', 'path', 'join'];
        var vars = [transformOptions.file, dirname, path, path.join];
        var args = node.arguments.map(function (arg){
          var t = "return " + arg.source();
          try {
            return Function(varNames, t).apply(null, vars)
          }
          catch (err){
            // Can't evaluate the arguments.  Return the raw source.
            return arg.source()                
          }
        });
        if (args[0] in depsObj){
          transformOptions.config.verbose && console.log('factored out: ', args[0])
          node.update(mangleName(args[0]));
        }
        else {
          transformOptions.config.verbose && console.log('left in: ', args[0]);
        }
      }
    });

    this.on('end', function() {
      var o = getOptions(transformOptions.config);
      var depsTuples = strArray2tuples(o.dependsOn);
      var fileMap = getFileMap(depsTuples);
      var files = fileMap2Bundles(fileMap);
      bundlesToVirtualFiles(files, function (err, f, bundlePath){
        if (err) {
          console.log(err);
          return;
        }
        var b = browserify(f, {basedir: process.cwd(), paths: ['./node_modules']});
        mkdirp.sync(path.dirname(bundlePath));
        b.bundle().pipe(fs.createWriteStream(bundlePath));
      });
    });

    done(null, output);
});

module.exports = stringTransform;
