var path = require('path');
var transformTools = require('browserify-transform-tools');
var utils = require('./utilities');
var quote = utils.quote;
var mangleName = utils.mangleName;
var adModName = '_d';

function wrap(exports, deps, sym, body){
  var d = '[' + deps.deps.map(quote).join(',') + '],';
  var a = deps.args.join(',');
  var s = sym ? quote(sym) + "," : "";
  var out = ["require('" + adModName + "')(" + s + d + "function(" + a + "){"];
  out.push(body);
  if (sym){
    out.push("return module.exports;");
  }
  out.push("});");

  return out.join("\n");
}

function enrichDeps (deps, removedDependencies){
  var additional = Object.keys(removedDependencies);

  var additionalDeps = additional.map(function (key){
    key.slice(removedDependencies[key].length)
    return removedDependencies[key].label + key.slice(removedDependencies[key].name.length);
  });

  var additionalArgs = additional.map(function (key){
    return mangleName(key);
  });

  return {
    deps: deps.deps.concat(additionalDeps),
    args: deps.args.concat(additionalArgs)
  }
}

var options = {excludeExtensions: [".json"]};
var wrapTransform = transformTools.makeStringTransform("browserify-async-define-1", options,
  function (content, transformOptions, done) {
    var o = transformOptions.config;
    var exports = o.exports;

    var deps = enrichDeps(o.deps, o.removedDependenciesOnCurrentFile);
    delete o.removedDependenciesOnCurrentFile;
    var file = transformOptions.file;

    if (file.indexOf('asyncDefine.js') !== -1) {
      done(null, content);
    }

    var output = (deps.deps.length > 0 || file in exports) ? wrap(exports, deps, exports[file], content) : content

    done(null, output);
});

var requireTransform = transformTools.makeRequireTransform("browserify-async-define-2",
  {evaluateArguments: true, excludeExtensions: [".json"]},
  function(args, transformOptions, done) {
    var o = transformOptions.config;
    var depsObj = o.depsObj;
    var first_segment = args[0].split('/')[0];
    if (first_segment in depsObj){
      transformOptions.config.verbose && console.log('factored out: ', args[0]);
      if (first_segment !== args[0]){
        o.removedDependencies[args[0]] = {label: depsObj[first_segment], name: first_segment};
        o.removedDependenciesOnCurrentFile[args[0]] = {label: depsObj[first_segment], name: first_segment};
      }
      return done(null, mangleName(args[0]));
    }
    else {
      transformOptions.config.verbose && console.log('left in: ', args[0]);
      return done();
    }
});

module.exports = {
  wrapTransform: wrapTransform,
  requireTransform: requireTransform
};
