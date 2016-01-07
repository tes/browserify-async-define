browserify-async-define
=======================
This browserify transformer can be used to wrap some dependencies using async-define and thus, factor out those in common bundles.

Options:
*  -d --dependsOn "name:label:filename" the dependency "name" will come from a different bundle with the label "label". If you add "filename" (optional) this dependency will be bundled in that file.
*  -e --exports "file:label" the module.exports of this file will be exposed with the label "label"
*  --verbose it will output which modules was removed and which stays. Useful to detect if a module is in because of a dependency of a dependency

With the main.js:
```js
var $ = require('jquery');
var $node = $('<div>Hello</div>').appendTo(document.body);
```
You can build bundle and main like this:
```
browserify main.js -o dist/main.js -t [browserify-async-define -d jquery:jquery:dist/common.js]
```

and then load them like this:
```html
<script async src="dist/common.js"></script>
<script async src="dist/main.js"></script>
```

You can factor out multiple dependencies and use the "label" to express different versions:
```
browserify main.js -o dist/main.js -t [browserify-async-define -d jquery:jquery20:dist/jquery.js -d react:react014:dist/react.js -d react-dom:reactDom014:dist/react.js]
```
and then load them like this:
```html
<script async src="dist/jquery.js"></script>
<script async src="dist/react.js"></script>
<script async src="dist/main.js"></script>
```

async-define will isolate the namespace and allow to use different versions of a package. 
