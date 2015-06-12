# Why Upgrades

This document attempts to motivate the "upgrades" feature of custom elements.

## Introduction

In this section, we lay some groundwork to explain how upgrades work, before getting in to the why.

### Simple upgrades example

The essence of upgrading is to allow element registration after parsing has already occurred for the relevant tag names. At this point any elements with appropriate name that already exist in the DOM are “upgraded” to the correct prototype, and their `createdCallback()` is run. For a simple example, consider

```html
<!DOCTYPE html>
<x-foo></x-foo>
<script>
  let called = false;
  class XFoo extends HTMLElement {
    createdCallback() {
      called = true;
    }
  }

  const el = document.querySelector("x-foo");
  assert(el.constructor === HTMLElement);
  assert(called === false);

  document.registerElement("x-foo", XFoo);
  assert(el.constructor === XFoo);
  assert(called === true);
</script>
```

(This assumes [the Dmitry solution](https://lists.w3.org/Archives/Public/public-webapps/2015JanMar/0230.html) is put in place to avoid the current spec's undesirable constructor generation.)

### How does this work

Essentially, while parsing, the UA keeps track of all elements with dashes in their name. When `document.registerElement` is called, it looks up the matching elements (which are currently instances of `HTMLElement`), then “proto-swizzles” them: it mutates their internal [[Prototype]] property to be the newly-appropriate prototype (`XFoo.prototype` in this example). At the same time, it runs the appropriate `createdCallback()`. In JavaScript, this looks approximately like

```js
Object.setPrototypeOf(el, XFoo);
el.createdCallback();
```

Note that (under the Dmitry solution) the end result is exactly the same as `new XFoo()`, due to how the constructor is defined.

### Drawbacks

The issue most often raised about upgrading is how it exposes an intermediate state, before the element finally settles down into its final API. That is, there are points in time where our `<x-foo>` is simply an HTMLElement. This can be observed by any script that runs before the `document.registerElement` call, or by script inside the element's `createdCallback`, during registration. For an example of the latter, consider

```html
<!DOCTYPE html>
<x-foo></x-foo>
<x-foo></x-foo>
…
```

If `XFoo.prototype.createdCallback` looks at `this.nextElementSibling`, it would find a `HTMLElement`, instead of an upgraded `XFoo`.

## Why Upgrades Are Important

In this section we argue that despite the drawbacks mentioned above, upgrades are still an important feature for the custom elements ecosystem. In a world without built-in upgrades, libraries and authors will be forced to re-invent them in a non-interoperable way, with all the same drawbacks in place and more.

### Modern front-end development

To see why upgrades are important, it's first necessary to recognize two important trends in modern front-end development:

- ubiquitous use of _asynchronous modules_, and
- an embrace of _progressive enhancement_ and server-side rendering.

Modern front-end development is extensively focused around asynchronous module systems and asynchronous module loading, including tools that compile ES2015 module syntax down to something that can be run and loaded in today's browsers. During development, or in production for simpler apps, every JavaScript module file is loaded asynchronously. For more complicated production apps, the modules are split up into logical bundles. An initial bundle is loaded (asynchronously, of course, so as not to block parsing) during initial render; others loaded as the user performs actions throughout the site, such as navigation, that necessitate loading relevant supporting code.

At the same time, there's been a resurgence of interest in progressively-enhanced content. In its modern incarnation, this is accomplished by first doing "server-side rendering" of some sort, to deliver static HTML to the client, and only later "hydrating" that HTML into fully-interactive framework-supported content. The main advantages cited for this are crawlability and speed (i.e. time-to-first-content). For more information, see the ways in which major frameworks are scrambling to support their users in this regard: [Ember](http://tomdale.net/2015/02/youre-missing-the-point-of-server-side-rendered-javascript-apps/), [Angular](https://docs.google.com/document/d/1q6g9UlmEZDXgrkY88AJZ6MUrUxcnwhBGS0EXbVlYicY/edit?pli=1), and [React](https://facebook.github.io/react/docs/top-level-api.html#react.rendertostring).

To summarize, modern web apps consist of:

1. An initial payload of largely-static content, delivered directly from the server, which may not be fully interactive but is crawlable and immediately visible;
2. Asynchronously loaded functionality, often provided by a full-featured component framework, for making that content interactive. (Ember's component definitions; Angular's directive definitions; React's element definitions.)

A very simple example of this in action can be seen with GitHub's [`<time>` element extensions](https://github.com/github/time-elements). If you view-source on the page, you will see the content that loads immediately before any JavaScript is delivered, and which is visible to crawlers:

```html
<time class="updated" datetime="2015-02-18T18:32:38Z" is="relative-time">Feb 18, 2015</time>
```

However, if you inspect-element on the page, you can see the upgraded HTML, which is the result of progressive enhancement by the asynchronously-loaded time-element code.

```html
<time title="Feb 18, 2015, 1:32 PM EST" class="updated" datetime="2015-02-18T18:32:38Z" is="relative-time">on Feb 18</time>
```

### Custom elements and modern development

One of the major promises of custom elements is to unify the disparate component models used by the various frameworks into a single interoperable one, that meshes well with the existing platform instead of trying to paper over it with virtual DOMs and a sea of `<div>`s. We claim that without upgrades, custom elements will simply not be able to do this.

As can be seen from the above section, modern web apps and framework component models do indeed perform their own "upgrade," in the same way custom elements do. This leads us to our thesis:

**Without a built-in upgrade functionality, apps and frameworks will be forced to reinvent it.** And it'll be worse.

The proposed world-without-upgrades leaves `<x-foo>` in our above example as a `HTMLElement` (or perhaps `HTMLUnknownElement`). This means that all of the server-rendered content will, instead of being progressively enhanced, be left as non-functional by default. This is of course unacceptable, so the authors of `<x-foo>` will need to provide a mechanism for making it functional. You could imagine a few solutions to this:

- A custom-elements-definition framework which performs proto-swizzling and uses a conventional method name afterward, similar to the specified process.
    + Which method name? It probably varies per framework; we've lost interoperability.
    + Now authors need to remember to activate this framework's upgrade functionality after asynchronously loading any relevant definitions, since `document.registerElement` doesn't do upgrades by itself.
    + This will require finding all un-upgraded instances of the tag name first, which is in itself somewhat costly.
    + The initialization method can, of course, see the intermediate states of the relevant elements.
    + There's no guarantee of consistency between `new XFoo()`, `<x-foo>` upgraded, `<x-foo>` parsed after registration, and `document.createElement("x-foo")`. The fact that no code can depend on this makes reusable abstractions harder to write.
- A script that tries to remove the `HTMLElement` version of `<x-foo>`, then replace it with `new XFoo()`.
    + This becomes way more complicated if an element has children.
    + Any event listeners will be lost.
    + Any `MutationObserver`s will be spammed.
    + This script could be hard to write generically, if we allow constructor signatures to vary. (Maybe the script could use `document.createElement("x-foo")` instead, but that isn't necessarily the same.)
- A script that simply re-parses relevant sections of the document, e.g. `justLoadedSection.innerHTML = justLoadedSection.innerHTML`, to get around the complications of selective replacement.
    + Any event listeners will be lost.
    + Any `MutationObserver`s will be spammed.
    + Horrible for performance and user experience.
    + Loss of encapsulation, as you may be re-parsing parts of the page outside your logical control.

All of these are not only an interoperability nightmare, they are also just plain unpleasant as a developer experience. They are signs of a standard focused more on theoretical purity (avoiding a visible intermediate state) than on meeting the needs of developers.

### Conclusion

Upgrades are not perfect. But something like them is needed by modern web development. Even if all we are providing with the spec is a single conventional method name (`createdCallback`) for interoperability, we stand to gain a lot in interoperability. And additionally, if we build an upgrade model into the spec, we can guarantee consistency between `new XFoo()`, `<x-foo>` upgraded, `<x-foo>` parsed after registration, and `document.createElement("x-foo")`.

But most of all, we should meet web developers where they already are, instead of forcing them to work around us. They're already doing upgrades, and always will be—one way or another.
