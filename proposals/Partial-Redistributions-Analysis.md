# Analysis of Partial Redistributions in Shadow DOM

See [Imperative API doc](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Imperative-API-for-Node-Distribution-in-Shadow-DOM.md#imperative-api-for-node-distribution-in-shadow-dom) for definition of redistribution.

**Partial Redistribution** happens when nodes are not wholly redistributed from one insertion point into another. For example:

### Unpacking redistribution example

```html

<!-- index.html -->
...
<d-scaffold>
  <div id="one" class="tool">Glorious Title</div>
  <div id="two" class="tool top">[ICON]</div>
  ...
</d-scaffold>
...

<!-- d-scaffold's shadow tree -->
<div id="wrapper">
  <d-toolbar>
    <content id="a" select=".tool"></content>
  </d-toolbar>
  ...
</div>

<!-- d-toolbar's shadow tree -->
<div id="top-shelf">
  <content id="b" select=".top"></content>
</div>
<div id="bottom-shelf">
  <content id="c"></content>
</div>

<!-- composed-ish tree -->
<d-scaffold>
  #shadowroot
    <div id="wrapper">
      <d-toolbar>
        #shadowroot
          <div id="top-shelf">
            <div id="two" class="tool top">[ICON]</div>
          </div>
          <div id="bottom-shelf">
            <div id="one" class="tool">Glorious Title</div>
          </div>
        /#shadowroot
      </d-toolbar>
    </div>
  /#shadowroot
</d-scaffold>
```

In this case, nodes distributed into one insertion point `#a` (that's `#one` and `#two`) are then redistributed into two insertion points `#b` (`#two`) and `#c` (`#one`).

In loose terms of shadow tree API (where insertion points could be viewed as [parameters](http://en.wikipedia.org/wiki/Parameter_%28computer_programming%29) and host's children are [arguments](http://en.wikipedia.org/wiki/Parameter_%28computer_programming%29#Argument_passing)), this type of partial could described as **unpacking**: that is, one tree API's parameter is *unpacked* into two or more arguments for nested tree APIs:

```js
// illustration purposes only, not a real JS API.
define('d-toolbar', [ 'top', 'bottom' ], (top, bottom) => {
  ...
});

define('d-scaffold', [ 'tool', ... ], (tool, ...) => {
  render('d-toolbar', {
    top: tool.unpack('.top'),
    bottom: tool.unpack('.bottom')
  })
  ...
});

```

### Refactoring Unpacking into Whole Distribution

It's fairly straightforward to turn any **unpacking** partial redistribution into a whole distribution. The pattern here is to factor unpacking up into the nesting API:


```js
// illustration purposes only, not a real JS API.
define('d-toolbar', [ 'top', 'bottom' ], (top, bottom) => {
  ...
});

define('d-scaffold', [ 'tool-top', 'tool', ... ], (toolTop, tool, ...) => {
  render('d-toolbar', {
    top: toolTop,
    bottom: tool
  })
  ...
});

```

Or, in the HTML example above:

### Unpacking Refactoring Example

```html

<!-- index.html -->
...
<d-scaffold>
  <div id="one" class="tool">Glorious Title</div>
  <div id="two" class="tool-top">[ICON]</div>
  ...
</d-scaffold>
...

<!-- d-scaffold's shadow tree -->
<div id="wrapper">
  <d-toolbar>
    <content id="a1" select=".tool-top"></content>
    <content id="a2" select=".tool"></content>
  </d-toolbar>
  ...
</div>

<!-- d-toolbar's shadow tree -->
<div id="top-shelf">
  <content id="b" select=".tool-top"></content>
</div>
<div id="bottom-shelf">
  <content id="c"></content>
</div>

<!-- composed-ish tree -->
<d-scaffold>
  #shadowroot
    <div id="wrapper">
      <d-toolbar>
        #shadowroot
          <div id="top-shelf">
            <div id="two" class="tool-top">[ICON]</div>
          </div>
          <div id="bottom-shelf">
            <div id="one" class="tool">Glorious Title</div>
          </div>
        /#shadowroot
      </d-toolbar>
    </div>
  /#shadowroot
</d-scaffold>
```