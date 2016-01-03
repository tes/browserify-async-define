var $ = require('jquery');
var React = require('react');
var ReactDOM = require('react-dom');
var $node = $('<div />').appendTo(document.body);
var node = $node.get(0);

var Hello = React.createClass({displayName: "hello", render: function (){
  return React.createElement('div', {className: 'helloworld'}, 'Hello World!');
}});

ReactDOM.render(
  React.createElement(Hello, null),
  node
);

