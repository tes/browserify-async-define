**Note: This is working and battle tested, but I suggest to use either webpack or rollup instead (I explain the reason at the bottom)**
* [webpack plugin](https://github.com/tes/webpack-async-define)
* [rollup plugin](https://github.com/tes/rollup-plugin-async-define)

browserify-async-define
=======================
This browserify plugin can be used to wrap some dependencies using async-define and thus, factor out those in common bundles.

Options:
*  -d --dependsOn "name:label[:filename]" the dependency "name" will come from a different bundle with the label "label". If you add "filename" (optional) this dependency will be bundled in that file.
*  -e --exports "file:label" the module.exports of this file will be exposed with the label "label"
*  --verbose it will output which modules was removed and which stays. Useful to detect if a module is in because of a dependency of a dependency
* --collapse the requires ids are transformed in numbers instead of strings (more compact bundles)

With the main.js:
```js
var $ = require('jquery');
var $node = $('<div>Hello</div>').appendTo(document.body);
```
You can build bundle and main like this:
```
browserify main.js -o dist/main.js -p [browserify-async-define -d jquery:jquery2.2:dist/common.js]
```
or using the api:
```
var browserifyAsyncDefine = require('browserify-async-define');
var b = browserify('main.js')
  .plugin(browserifyAsyncDefine, {
    dependsOn: ['jquery:jquery2.2:dist/common.js]
  });
```

and then load them like this:
```html
<script async src="dist/common.js"></script>
<script async src="dist/main.js"></script>
```

You can factor out multiple dependencies and use the "label" to express different versions:
```
browserify main.js -o dist/main.js -p [browserify-async-define -d jquery:jquery20:dist/jquery.js -d react:react014:dist/react.js -d react-dom:reactDom014:dist/react.js]
```
and then load them like this:
```html
<script async src="dist/jquery.js"></script>
<script async src="dist/react.js"></script>
<script async src="dist/main.js"></script>
```

async-define will isolate the namespace and allow to use different versions of a package.

peerDependencies
================
To use this plugin you should also install this package:
```
"async-define": "latest",
```

Why avoiding this
-----------------
async-define has the same interface used by AMD modules. So it was very easy to create a rollup or webpack plugin because they are already able to produce an AMD output of the bundle. This plugin instead is pretty complicated and heavy to maintain. I consider this to be **deprecated** and only apply the least possible maintenance.