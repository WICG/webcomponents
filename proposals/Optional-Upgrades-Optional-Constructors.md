# Optional Upgrades, Optional Constructors

This proposal is predicated on the idea that we answer [the key question](https://lists.w3.org/Archives/Public/public-webapps/2015JulSep/0159.html), i.e. whether or not we allow custom constructors, in the affirmative. It then explores when and how we can support [upgrades](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Why-Upgrades.md) in such a world, in the spirit of allowing developers to choose the appropriate tradeoff, and balancing the competing features which various parties all think are important.

## Introduction via code

The basic idea is that you can choose one or the other, between upgrades and custom constructors.

### Custom constructors; no upgrades

The basic form of defining an element allows a custom constructor, but does not allow or attempt any upgrades:

```html
<!DOCTYPE html>
<x-foo></x-foo>

<script>
"use strict";

window.XFoo = class XFoo extends HTMLElement {
    constructor() {
        super();
        this.prop = "value";
        this.appendChild(document.createElement("p"));
        this.firstChild.textContent = "hello";
    }
};

document.registerElement("x-foo", XFoo);
</script>

<x-foo></x-foo>

<script>
"use strict";

const [xfoo1, xfoo2] = document.querySelectorAll("x-foo");

assert(xfoo1.constructor === HTMLUnknownElement);
assert(xfoo2.constructor === XFoo);

assert(xfoo1.prop === undefined);
assert(xfoo2.prop === "value");

assert(xfoo1.innerHTML === "");
assert(xfoo2.innerHTML === "<p>hello</p>");
</script>
```

### Upgrades; no custom constructors

To upgrade any existing elements, you call `document.upgradeElementsFor(localName)`. However, this only works if you have not overridden the default constructor, in which case you will probably want to use the `[Element.created]()` callback:

```html
<!DOCTYPE html>
<x-foo></x-foo>

<script>
// Library code
"use strict";

window.XFoo = class XFoo extends HTMLElement {
    [Element.created]() {
        this.prop = "value";
        this.appendChild(document.createElement("p"));
        this.firstChild.textContent = "hello";
    }
};

document.registerElement("x-foo", XFoo);
</script>

<x-foo></x-foo>

<script>
// Author code
"use strict";

document.upgradeElementsFor("x-foo");

const [xfoo1, xfoo2] = document.querySelectorAll("x-foo");

assert(xfoo1.constructor === XFoo);
assert(xfoo2.constructor === XFoo);

assert(xfoo1.prop === "value");
assert(xfoo2.prop === "value");

assert(xfoo1.innerHTML === "<p>hello</p>");
assert(xfoo2.innerHTML === "<p>hello</p>");
</script>
```

The advantage of separating out `document.registerElement` an `document.upgradeElementsFor`, instead of e.g. having a `document.defineElement("x-foo", { upgrade }, C)` method, is that it allows proper separation of responsibilities. Usually, a library is what's responsible for custom element registration, and not the author of a web app. But it's the author who is in a better position to know whether or not upgrades are appropriate for their page, i.e., only the author knows whether they are planning to practice progressive enhancement. Thus, as hinted at in the above example, it is usually _library code_ calling `document.registerElement`, whereas it is _author code_ calling `document.upgradeElementsFor`.

This means that typical author code which wants to take advantage of upgrades might look like

```html
<!DOCTYPE html>
<link rel="preload" href="xfoo.js">

<x-foo></x-foo>

<script>
  loadScript("xfoo.js").then(() => {
    document.upgradeElementsFor("x-foo");
  });
</script>
```

Of course, some libraries may choose to unconditionally do upgrades for their authors.

### Trying to do both fails

It is of course not possible to do upgrades with custom constructors in the picture, so trying will fail at upgrade-time:

```html
<!DOCTYPE html>
<x-foo></x-foo>

<script>
"use strict";

document.registerElement("x-foo", class XFoo extends HTMLElement {
    constructor() {
        super();
        // doesn't matter what you put here; simply overriding the
        // constructor causes the error.
    }
});

assertThrows(DOMException, () => {
    document.upgradeElementsFor("x-foo");
});
</script>
```

### Doing neither is fine

You can avoid upgrades and still stick with the default constructor, if you want:

```html
<!DOCTYPE html>
<x-foo></x-foo>

<script>
"use strict";

window.XFoo = class XFoo extends HTMLElement {
    [Element.created]() {
        this.prop = "value";
        this.appendChild(document.createElement("p"));
        this.firstChild.textContent = "hello";
    }
};

document.registerElement("x-foo", XFoo);
</script>

<x-foo></x-foo>

<script>
"use strict";

// no document.upgradeElementsFor call

const [xfoo1, xfoo2] = document.querySelectorAll("x-foo");

assert(xfoo1.constructor === HTMLUnknownElement);
assert(xfoo2.constructor === XFoo);

assert(xfoo1.prop === undefined);
assert(xfoo2.prop === "value");

assert(xfoo1.innerHTML === "");
assert(xfoo2.innerHTML === "<p>hello</p>");
</script>
```

### If you customize the constructor, it must not throw

If your constructor attempts to require arguments, or otherwise throws, this will cause element creation to fail. [I'm not sure what the correct behavior is in that case.](https://lists.w3.org/Archives/Public/public-webapps/2015JulSep/0180.html) But it's important to note. Example code illustrating the issues would be

```html
<!DOCTYPE html>
<script>
"use strict";

window.throwingMode = true;

class XFoo extends HTMLElement {
    constructor() {
        if (window.throwingMode) {
            throw new Error("uh-oh!");
        }
    }
}

document.registerElement("x-foo", XFoo);
</script>

<x-foo></x-foo>

<script>
"use strict";

// What does the DOM tree look like here? Is an x-foo present in some form?
// HTMLUnknownElement maybe? Just removed from existence?

// This will presumably throw:
document.body.innerHTML = "<x-foo></x-foo>"; // But will it wipe out body first?

// What about
document.body.innerHTML = "[512 KiB of normal HTML] <x-foo></x-foo>";
// ? does the HTML make it in, or does the operation fail atomically, or something else?


// Now let's try something weirder.
// Assume <x-bar> / XBar is a well-behaved custom element.

window.throwingMode = false;
const el = document.createElement("div");
el.innerHTML = "<p>a</p><x-bar></x-bar><x-foo>b</x-foo><p>b</p><x-bar></x-bar>";

window.throwingMode = true;
el.cloneNode(true); // this will throw, presumably...
// ... but does the XBar constructor run or not?
// ... if so, how many times?
</script>
```

## Vague sketch of proposed APIs and processing model

The processing model is essentially a combination of the synchronous constructors idea and the "Dmitry" idea. Synchronous constructors is not very well-defined, and some replies in [this thread](https://lists.w3.org/Archives/Public/public-webapps/2015JulSep/0159.html) note the difficulty of specifying it. The Dmitry model is more well-understood.

Much of the spec is similar to how it exists currently. A superficial change is that we replace string-based lifecycle hook names (`"createdCallback"` etc.) with symbol-based ones (`Element.created` etc.). The changes are largely to `registerElement`, and the new method `upgradeElementsFor`. We also remove all the complications related to inheriting from native elements (`is=""` and friends).

### `Document.prototype.registerElement(DOMString localName, Function C)`

- The element registration algorithm no longer does upgrades.
- There is no longer a constructor generated via the custom element constructor generation algorithm; instead, `C` is stored directly in the registry.

### `Document.prototype.upgradeElementsFor(DOMString localName)`

- The upgrade logic moves here.
- As a precondition, a check is done that the constructor `C` in the registry is not customized (i.e. is the default constructor). If it is not, throw a DOMException.
- Upgrade logic for each is, of course: swizzle the prototype, then enqueue the created callback.

## Issues for discussion

- Should we expose the getUpgradeCandidates primitive? Seems fine, but we must have an ergonomic single-op upgrading method.
- How do we spec the sync constructors processing model?
- What do we do for throwing constructors?
