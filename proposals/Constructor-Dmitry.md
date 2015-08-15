# The "Constructor Dmitry" Custom Elements Proposal

This document outlines a proposal for the custom elements API which is an evolution of the ["Dmitry" proposal](https://lists.w3.org/Archives/Public/public-webapps/2015JanMar/0230.html), combined with the "constructor call trick" realized at the Custom Elements F2F. It is meant to provide a starting point, with an ergonomic API, from which other proposals (such as those attempting to address the [consistent world view issue](https://annevankesteren.nl/2015/07/shadow-dom-custom-elements-update)) can proceed. Alternately, perhaps it is good enough as-is; as we show, the consistent world view issue is fairly minor in this formulation.

## Examples

Let's try to illustrate a minimal example of how this all works by taking inspiration from [x-gif](https://geelen.github.io/x-gif/). In particular, `minimal-x-gif` will only support a `src` attribute (which is allowed to be changed after creation).

### Basic authoring

To author a custom element, you simply author the class:

```js
class MinimalXGif extends HTMLElement {
    constructor(src) {
        super();

        if (src !== undefined) {
            this.src = src;
        }

        // Children are fallback progressive-enhancement content;
        // they only display pre-upgrade.
        insertStylesIntoShadowDOMToHideChildren(this);
    }

    get src() {
        return (new URL(this.getAttribute("src"), this.baseURI)).href;
    }
    set src(value) {
        this.setAttribute("src", value);
    }

    [Element.attributeChanged](name) {
        if (name === "src") {
            const src = this.src;
            updateShadowDOMFromAbsoluteURL(this, src); // magic omitted
        }
    }

    [Element.attached]() {
        startPlayingStuffInShadowDOM(this);
    }

    [Element.detached]() {
        stopPlayingStuffInShadowDOM(this);
    }
}
```

If you'd like to register it, you can (although you might hold off on this to allow consumers to choose a name):

```js
document.registerElement("minimal-x-gif", MinimalXGif);
```

Note how unlike the current proposal, we do not care about the return value. This is because unlike the current proposal, the second argument is not treated as a dumb `{ prototype }` property back, but instead as a full-fledged class. (This is the essential victory of the original Dmitry proposal.)

### Use after registration

Let's say we are content to use our element only after it loads. So we end up with something like

```html
<!DOCTYPE html>
Here is some non-custom stuff.

<div id="placeholder"><p>Please wait, loading cool things<p></div>

<script type="module">
// Remember, this whole module will execute asynchronously after minimal-x-gif.js loads.
import MinimalXGif from "./minimal-x-gif.js";
document.registerElement("minimal-x-gif", MinimalXGif);

document.querySelector("#placeholder > p").replaceWith(new MinimalXGif("foo.gif"));
</script>
```

Here we see: `new MinimalXGif(...)` runs the constructor, which calls `super()` to initialize the underlying HTML element stuff, then sets the `this.src` to `"foo.gif"`, which in turn sets the `src` attribute. In reaction, the UA enqueues a nanotask (see below) to call the element's `[Element.attributeChanged]` callback, with appropriate parameters. The next transition back from UA code to author code happens precisely as `setAttribute` finishes, so the action is immediate. The shadow DOM thus gets updated even before the element is inserted into the DOM. Once it _is_ inserted, we enqueue the element's `[Element.attached]` callback, which executes right before the `replaceWith` call returns.

### Use before registration (upgrading)

Let's say we want to make use of our element's cleverly-coded progressive enhancement capabilities, and load it asynchronously. This might look something like

```html
<!DOCTYPE html>
Here is some non-custom stuff.

<minimal-x-gif src="foo.gif">
    A textual description of a foo. Or maybe even a &lt;img src&gt;!?
</minimal-x-gif>

<script>
"use strict";

// This script is showing how you can usefully get a reference to the minimal-x-gif
// even before ugprading, e.g. to add event handlers or store it in a global.

const gif = document.querySelector("minimal-x-gif");
assert(gif.constructor === HTMLElement); // not upgraded yet

gif.addEventListener("click", doSomethingCool);
window.gif = gif;
</script>

<script type="module">
// Remember, this whole module will execute asynchronously after minimal-x-gif.js loads.
import MinimalXGif from "./minimal-x-gif.js";
document.registerElement("minimal-x-gif", MinimalXGif);

assert(window.gif.constructor === MinimalXGif); // all upgraded
</script>
```

Here we see how at parse-time, a simple `HTMLElement` is created; this is in evidence by the `<script>` that runs immediately after the minimal-x-gif. While `minimal-x-gif.js` is loading, the fallback content will be displayed, but clicking on that fallback content will still `doSomethingCool`.

After `minimal-x-gif.js` loads, registration occurs, which triggers the upgrade procedure. This then does several things:

- It enques a nanotask to use the constructor-call trick to call `MinimalXGif` such that `super()` inside of that execution sets `this` to the appropriate element in the document. Thus, when the constructor does `insertStylesIntoShadowDOMToHideChildren(this)`, it is the `<minimal-x-gif>` in the document which gets operated on, hiding its children. The constructor is called with no arguments, so the `this.src = src` line does not execute; all custom element constructors must conform to this contract.
- It enqueues a nanotask to call the element's `[Element.attributeChanged]` callback, since the `<minimal-x-gif>` element in the document had a `src` element. So, it will call `updateShadowDOMFromAbsoluteURL` with the appropriately-calculated `src` value.
- It enqueues a nanotask to call the element's `[Element.attached]` callback, since the element was in the document. So it will call `startPlayingStuffInShadowDOM`.

Immediately before `registerElement` returns, all these nanotasks execute in sequence. Of course, the event handler is still preserved, and the global variable stays the same.

### Not in the document

Let's modify the above example slightly to show how upgrades work on elements not in the document. This isn't exactly realistic code, but rather is showing the process.

```html
<!DOCTYPE html>
<script>
"use strict";

window.gif = document.createElement("minimal-x-gif");
window.gif.setAttribute("src", "foo.gif");
assert(window.gif.constructor === HTMLElement); // not upgraded yet
window.gif.addEventListener("click", doSomethingCool);
</script>

<script type="module">
// Remember, this whole module will execute asynchronously after minimal-x-gif.js loads.
import MinimalXGif from "./minimal-x-gif.js";
document.registerElement("minimal-x-gif", MinimalXGif);

assert(window.gif.constructor === MinimalXGif); // all upgraded
</script>
```

This example is similar to the previous one, with the exception of the attached callback not being called. The attribute changed callback _is_ called, notably.

## Semi-detailed semantics

### Parsing changes

As in the current proposal, the parser is changed so that [elements named in a way so that they could be custom elements](https://w3c.github.io/webcomponents/spec/custom/#dfn-unresolved-element) are created as `HTMLElement` instead of `HTMLUnknownElement`. This prevents lateral transitions (from `HTMLUnknownElement` to `XCustomElement`) during upgrades, since those would be weird; instead we have a simple upgrade transition from `HTMLElement` to `XCustomElement`.

### Nanotasks

We should formalize the concept of "nanotasks" and the "nanotask queue" that are currently embodied by the custom element callback queue. See https://www.w3.org/Bugs/Public/show_bug.cgi?id=24579. In the meantime, we use "nanotask" in this document to mean the same.

Notably, it's not clear why each custom element needs its own nanotask queue, as in the current spec. If there is a good reason, we should remember to add an explanatory informative note.

### The element registry and `document.registerElement`

Each document has a **custom element registry**, which is a map of names (following [the usual restrictions](https://w3c.github.io/webcomponents/spec/custom/#dfn-custom-element-type)) to author-defined constructor functions and some derived viscera: namely prototypes and lifecycle callbacks.

`document.registerElement(name, C)`'s job is extremely simple:

- It adds the mapping

  ```
  name ~> {
      constructor: C,
      prototype: C.prototype,
      attributeChanged: C.prototype[Element.attributeChanged],
      attached: C.prototype[Element.attached],
      detached: C.prototype[Element.detached]
  }
  ```

  to the document's custom element registry.
- It performs the upgrade procedure for _name_ (see below).

Unlike the current proposal, no new classes are minted. Somewhat similar to the current proposal, we copy over various things from the constructor and prototype into the definition. This is done so that custom elements have the same "non-disturbable" property that normal elements have. That is, if you do `HTMLParagraphElement.prototype = randomStuff`, that doesn't actually impact the UA's creation of paragraph elements; similar invariants should hold for custom elements.

### Creating Already-Registered Elements

To create a custom element, e.g. when parsing an element whose definition has already been registered, you first create a normal `HTMLElement` _el_, then you upgrade _el_.

The consequences of this are that:

- Both parser-created custom elements and upgraded custom elements will have their constructor and attributeChange callbacks called at a time when all their children and attributes are already present.
- Elements created via `new XCustomElement()` or `document.createElement("x-custom-element")` will have their constructor run at a time when no children or attributes are present.

The mismatch between these two scenarios is known as the "consistent world view" issue, and attempts to solve it are essentially about finding ways to ensure that the world view in the former case looks more like that in the latter.

### Upgrades

Each document has a **current upgrade candidate**, which can either be `null` or an element being upgraded.

The upgrade procedure for a given name _n_ is as follows:

1. Let _els_ be all upgrade candidates with name _n_.
1. For each _el_ in _els_, upgrade _el_.
1. Set the document's current upgrade candidate to `null`.

To upgrade an element _el_:

1. Assert: _el_ is a parser-created `HTMLElement`, per the parsing changes section.
1. Let _C_, _p_, _attributeChanged_, and _attached_ be the constructor, prototype, attributeChanged, and attached entries in the custom elements registry for _el_'s name.
1. Do SetPrototypeOf(_el_, _p_).
1. Set the document's current upgrade candidate to _el_.
1. Construct(_C_), reporting any exceptions without interrupting execution flow
    - This, in combination with the previous step and the definition of the `HTMLElement` constructor, executes the constructor-call trick. After the author-defined _C_ calls `super()`, its `this` will be set to _el_, thus effectively "calling" the author-defined constructor on _el_ (similar to `C.call(el)` in the ES5 world).
1. For each attribute of _el_, enqueue a nanotask call _attributeChanged_ appropriately, with its `this` set to _el_ and its arguments derived from the attribute.
1. If _el_ is in the document, enqueue a nanotask to call _attached_ with its `this` set to _el_.

### Definition of the HTMLElement constructor

To derive a working ES2015 class from `HTMLElement`, `HTMLElement` must have a working constructor, so that the (required) `super()` call in the derived constructor succeeds. Furthermore, in order to apply the "constructor call trick" for upgrades, this constructor needs to be somewhat tricky. Please see [domenic/element-constructors](https://github.com/domenic/element-constructors) for an earlier draft, which doesn't include the constructor call trick, and has a few open issues, but does illustrate a lot of the complexity omitted here (e.g. how much of the logic actually ends up in the `Element` constructor). I am happy to revive that repo on demand and flesh out how it would work now. However, for our purposes, it suffices to understand a few salient points:

- Per the upgrades section, the document has a current upgrade candidate, which can be either `null` or an element being upgraded. If it is non-`null`, then the `HTMLElement` constructor must simply return that. (This is the essence of the constructor-call trick.)
- Otherwise, if this constructor is not being called as part of an upgrade-related constructor call trick, it can use `new.target` to determine if it is being called as a superconstructor call of a custom element, and if so, use the custom element registry to retrieve the appropriate name to initialize its internal state.

Together, these allow functional subclassing of `HTMLElement`, and accomodate upgrading.

### Definition of the lifecycle callbacks

The lifecycle callbacks in this proposal, and their corresponding symbols, are:

- attribute changed / `Element.attributeChanged`
- attached (inserted into document) / `Element.attached`
- detached (removed from document) / `Element.detached`

This set can be changed per the many pending discussions, e.g. adding children changed or generalizing the inserted/removed callbacks. But we start with the minimal delta from the current proposal for now. However, we particularly encourage the addition of a children changed callback, which would automatically get called during upgrades (and thus during element creation), as this would help encourage the use of childrenChanged instead of processing children in the constructor.

As explained more explicitly in other sections, the deltas from the current spec are essentially that:

- We use symbols instead of strings to name these callbacks.
- We use the constructor, with the constructor-call trick, instead of `createdCallback`.
- We call `attributeChanged` during upgrade time and element-creation time.
