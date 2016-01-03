browserify-async-define
=======================
This is browserify transformer can be used to wrap some dependencies using async-define and thus, factor out those dependencies in common bundles.

Options:
*  -d --dependsOn "name:label" the dependency "name" will come from a different bundle with the label "label"
*  -e --exports "file:label" the module.exports of this file will be exposed with the label "label"

With the main.js:
```js
var $ = require('jquery');
var $node = $('<div>Hello</div>').appendTo(document.body);
```
and bundle.js:
```js
module.exports = require('jquery');
```

You can build bundle and main like this:
```
browserify demo/main/main.js -o demo/dist/main.js -t [browserify-async-define -d jquery:jquery]
browserify demo/bundle/bundle.js -o demo/dist/bundle.js -t [browserify-async-define -e demo/bundle.js:jquery]
```

and then load them like this:
```html
<script async src="dist/main.js"></script>
<script async src="dist/bundle.js"></script>
```
