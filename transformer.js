var path = require('path');
var falafel = require('falafel');
var transformTools = require('browserify-transform-tools');
var utils = require('./utilities');
var quote = utils.quote;
var mangleName = utils.mangleName;

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

var options = {excludeExtensions: [".json"]};
var stringTransform = transformTools.makeStringTransform("browserify-async-define", options,
  function (content, transformOptions, done) {
    var o = transformOptions.config;
    var exports = o.exports;
    var depsObj = o.depsObj;
    var deps = o.deps;

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
        
        var first_segment = args[0].split('/')[0];
        
        if (first_segment in depsObj){
          transformOptions.config.verbose && console.log('factored out: ', args[0]);
          node.update(mangleName(args[0]));
        }
        else {
          transformOptions.config.verbose && console.log('left in: ', args[0]);
        }
      }
    });

    done(null, output);
});

module.exports = stringTransform;
