var path = require('path');
var falafel = require('falafel');
var transformTools = require('browserify-transform-tools');

function mangleName(n){
  return "__" + n;
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

function array2obj(a){
  // ["a:2", "b"]  ---->  {a:2, b: "b"}
  return a.map(function (item){
    var items = item.split(':');
    return items.length === 2 ? items : [item, item];
  })
  .reduce(function (previous, tuple){
    previous[tuple[0]] = tuple[1];
    return previous;
  }, {});
}

function invertMap(o){
  var out = {};
  for (var k in o){
    out[o[k]] = k;
  }
  return out;
}

function getOptions(o) {
  // expecting o.d or o.dependsOn and o.e or o.exports
  var out = {};
  out.dependsOn = "d" in o ? o.d : "dependsOn" in o ? o.dependsOn : [];
  out.exports = "e" in o ? o.e : "exports" in o ? o.exports : [];
  return out;
}

var options = {excludeExtensions: [".json"]};
var stringTransform = transformTools.makeStringTransform("browserify-async-define", options,
  function (content, transformOptions, done) {
    var o = getOptions(transformOptions.config);
    
    var exports = getExports(array2obj(o.exports));
    var depsObj = array2obj(o.dependsOn);
    var deps = getDeps(depsObj);
    var labels = invertMap(depsObj);
    
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
        if (args[0] in labels){
          node.update(mangleName(labels[args[0]]));
        }
      }
    });

    done(null, output);
});

module.exports = stringTransform;
