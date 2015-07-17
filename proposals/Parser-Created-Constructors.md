# Parser-Created Classes

The germ of this proposal is the idea that the parser can create custom element classes as it encounters unknown tags. This sidesteps any issues around [upgrading](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Why-Upgrades.md) and constructor identity entirely, and avoids the many issues involved in allowing authors to customize the constructor (such as then needing to run author code during parsing, cloning, editing, etc.). In particular, it avoids the dreaded "proto-swizzling."

This proposal gives up on the idea of subclassing native elements. It currently does not contain a mechanism for custom elements to subclass each other, either, although this could be added with a bit of extra trickery; see the section at the end.

## Introduction via example code

The basic idea, without any APIs, can be illustrated with the following example:

```html
<!DOCTYPE html>
<x-foo></x-foo>
<x-bar></x-bar>

<script>
"use strict";

// By the time this script has run, the *parser* has already created
// (distinct) classes corresponding to x-foo and x-bar.

const XFoo = document.querySelector("x-foo").constructor;
const XBar = document.querySelector("x-bar").constructor;

assert(XFoo !== HTMLElement);
assert(XFoo !== XBar);
assert(Object.getPrototypeOf(XFoo) === HTMLElement);
</script>
```

The `document.querySelector("x-foo").constructor` dance is a bit awkward. Let's replace that with something a bit more ergonomic:

```js
const XFoo = document.elementsRegistry.get("x-foo");

// Can also use it on non-custom elements
assert(document.elementsRegistry.get("p") === HTMLParagraphElement);
assert(document.elementsRegistry.get("section") === HTMLElement);
```

Given this, we can customize our custom elements as desired:

```js
const XFoo = document.elementsRegistry.get("x-foo");

XFoo.prototype.method = function () {
  // do stuff
};

Object.defineProperty(XFoo.prototype, 'getter', {
  enumerable: true,
  configurable: true,
  get: function () {
    // return stuff
  }
});
```

This isn't exactly pleasant, so we can offer a bit of sugar:

```js
document.elementsRegistry.extend("x-foo", {
  method() {
    // do stuff
  },

  get getter() {
    // return stuff
  }
});
```

However, we haven't yet figured out how to allow elements to initialize themselves. We could hack it:

```js
for (const el of document.querySelectorAll("x-foo")) {
  initializeXFoo(el);
}

(new MutationObserver(mutations => {
    for (const added of mutations.addedNodes) {
      if (added.localName === "x-foo") {
        initializeXFoo(el);
      }
    }
})).observe(document, { childNodes: true, subtree: true });
```

But that's pretty gross. We'd rather not have every custom elements library running a document-wide `childNodes` + `subtree` mutation observer. And as usual, the mutation observer timing is a bit problematic, e.g. if you insert something into the document, it won't be fully initialized until the microtask queue runs. Plus, it doesn't work for elements that are created but are not inserted into the document.

For this, we'll re-introduce the idea of "custom element callbacks," or lifecycle hooks. We register these via a new method:

```js
document.elementsRegistry.setLifecycle("x-foo", {
  created(el) {
    initializeXFoo(el);
  }
});
```

The UA would then do two things (before returning to script):

- Use that to "upgrade" any currently-present `<x-foo>` elements, and
- Store it for later use immediately after any `<x-foo>`s are created.

This means that e.g. during parsing and cloning, first the UA would run all the UA-generated constructors and assemble them into a tree. Then, in tree order, it would call the appropriate `created` hook for each newly-created element. Finally, it would return control back to the script.

## Detail on proposed APIs and processing model

(This is intended to be written in a way that makes it reasonably clear what needs to be specced, without necessarily being a full spec. Notably, we often access properties "unsafely" instead of going through internal concepts. But anyway, if you spot any particularly bad imprecisions, let me know.)

### The elements registry

The new `ElementsRegistry` interface provides access to the document's registry of elements, including the ability to extend custom elements and register lifecycle hooks for them:

```webidl
partial interface Document {
  [SameObject] readonly attribute ElementsRegistry elementsRegistry;
};

interface ElementsRegistry {
  Function get(DOMString localName);
  boolean has(DOMString localName);
  Function extend(DOMString localName, object extensions);
  Function setLifecycle(DOMString localName, CustomElementLifecycleHooks hooks);
};

dictionary CustomElementLifecycleHooks {
  Function? created = null;
  Function? attached = null;
  Function? detached = null;
  Function? attributeChanged = null;
}
```

Each _document_ has an _elements registry_, which is a map of local names (in the HTML namespace) to constructors and lifecycle hooks. A document's elements registry is initially populated by every HTML element defined in [HTML], mapping their local names to their corresponding constructors defined in that specification, with no-op (but present) lifecycle hooks.

During parsing, any unknown elements which are encountered and which contain a U+002D HYPHEN-MINUS character must cause the parser to add an entry into the registry for that local name, mapped to a newly-created constructor. This newly-created constructor must have a `name` property derived by de-dasherizing the local name. (So, if the parser encounters `<x-foo-bar>`, we must have `elementsRegistry.get("x-foo-bar").name === "XFooBar"`.) The constructor should take no arguments and initialize the element's state appropriately.

_NOTE: the constructor could be formalized in terms of the separate [element-constructors](https://github.com/domenic/element-constructors) proposal._

#### ElementsRegistry.prototype.get(DOMString localName)

1. If the document's elements registry has an entry with local name _localName_, return it.
2. Otherwise, return `undefined`.

#### ElementsRegistry.prototype.has(DOMString localName)

1. If the document's elements registry has an entry with local name _localName_, return `true`.
2. Otherwise, return `false`.

#### ElementsRegistry.prototype.extend(DOMString localName, object extensions)

1. If the document's elements registry does not have an entry with local name _localName_, create one, with the constructor generated the same was as would be done during parsing (see above), and no hooks.
2. Let _C_ be the entry in the document's elements registry with local name _localName_.
3. For each property in _extensions_, overwrite (by copying the entire property descriptor) the corresponding property on `C.prototype`.
4. Return _C_.

(The return value is just for chaining convenience of consumers.)

#### ElementsRegistry.prototype.setLifecycle(DOMString localName, CustomElementLifecycleHooks hooks)

1. If the document's elements registry already has hooks for the local name _localName_, throw a **TypeError**.
2. Store _hooks_ as the hooks for _localName_ in the document's elements registry.
3. Let _existingEls_ be all existing elements with owner document equal to this element registry's document, with the HTML namespace and local name _localName_.
3. If `hooks.created` was non-`null`,
  1. For each element _el_ in _existingEls_, run `hooks.created(el)`.
4. If `hooks.attributeChanged` was non-`null`,
  1. For each element _el_ in _existingEls_, and each attribute _attr_ the element has, run `hooks.attributeChanged(el, attr.localName, null, attr.value, attr.namespaceURI)`.
5. If `hooks.attached` was non-`null`,
  1. For each element _el_ in _existingEls_, if _el_ is in the document, run `hooks.attached(el)`.

_NOTE: since existing HTML elements have no-op lifecycle hooks, trying to use `setLifecycle` on them will throw._

### Element creation

All places that create an element need to be updated to run the `created` hook as appropriate. This must be done on a case-by-case basis as the behavior will vary in the specifics. In general, the idea is to batch the `created` calls together right before returning to script, in a similar manner to the existing custom element callbacks.

For example:

- Parser-generated custom element constructors must call `created` if present. (Or rather, somehow  `created` must happen; it doesn't necessarily need to be called by the constructor per se.)
- `document.createElement` must execute  `created` on its return value before returning.
- Parsing (e.g. of new HTML inserted with `innerHTML`) must run `created` hooks, in tree order, on all elements that result from parsing.
- Cloning behaves similar to parsing.

## Notable comparisons with the current custom elements spec

All lifecycle callbacks behave much as they do in the current spec, apart from as noted here. They are triggered not as methods but as functions, retrieved from the document's elements registry. Also, more than just the `created` hook runs during "upgrades".

Since there is no clear point of registration, we would make `:unresolved` match elements whose `created` hook has not ever been registered. This is a bit different, but in practice is probably fine: people will only use `:unresolved` if an element actually needs to do something interesting on creation. Probably?

## Points for discussion

### Inheritance

One crucial feature of this proposal is how it does not support inheritance—even from other custom elements. (Inheriting from native elements is extremely hard to define correctly; the current `is=""` design is not great. We leave that aside.)

This essentially falls out naturally from the basic idea of this proposal, where authors are not in control of creating the constructors (and thus the classes) representing the custom elements. Since they cannot define the classes themselves, they cannot define an `extends` clause, and thus cannot properly set up the inheritance relation. (See below for an "improper" method, though.)

On the one hand, this is a bit disappointing. Inheritance is a common feature in UI toolkits and control hierarchies, and could be nice to have.

On the other hand, perhaps it isn't so bad. We all know to favor composition over inheritance. Analyzing common UI frameworks, it's fairly rare that the inheritance properly models [Liskov-substitutable](https://en.wikipedia.org/wiki/Liskov_substitution_principle) "is a" relationships. Instead, it is often "is implemented in terms of," or sometimes "is a in the conceptual sense, but not truly Liskov-substitutable." Perhaps we don't want to carry over such antipatterns to the web. And after all, HTML itself does not have any such inheritance hierarchies, where elements inherit from other elements. (It has the `HTMLAudioElement` and `HTMLVideoElement` inheriting from `HTMLMediaElement`, but the latter is an abstract base class, and not a proper element in and of itself.)

Finally, it _is_ possible to induce inheritance, via the dreaded proto-swizzling:

```js
const XFoo = document.elementsRegistry.get("x-foo");
const XBar = document.elementsRegistry.get("x-bar");
Object.setPrototypeOf(XFoo, XBar);
Object.setPrototypeOf(XFoo.prototype, XBar.prototype);
```

This will fully work (including `super.method()` calls). We could sanction it with something like `document.elementsRegistry.inherit("x-foo", "x-bar")`. Note that this proto-swizzling is not _so_ dreadful, compared to the current spec; it is only two proto-swizzles, instead of one per instance of the class.

However, this raises the problem of how to allow lifecycle hooks to call their "super" versions. E.g. if I inherit `XFoo` from `XBar`, I might want the `created` hook for `XFoo` to call the created hook for `XBar`. This is hard to do; you can imagine solutions, all of various degrees of messiness.

### Allowing hooks for non-custom elements

It would be quite easy to modify the spec to allow setting the lifecycle hooks for non-custom elements, so that e.g. authors could run code every time a `<div>` is created. Is this desirable? What are the use cases? It suffers [the multiple-actor problem](https://gist.github.com/dglazkov/fee1dcb9690baf73dff0) in general.

The spec currently only allows setting the lifecycle hooks once, on the assumption that this is done by the component author. If we were to allow setting them for non-custom elements, we'd probably want to relax this restriction, so that e.g. each hook actually becomes a list of functions instead of just a single function.

### Other namespaces

The above proposal currently hard-codes the HTML namespace (`http://www.w3.org/1999/xhtml`). Should we allow anything else, like SVG? That seems like something that can be delayed for the future, but perhaps we'd need to ensure the design does not prohibit it. Or, maybe this problem will go away, when the SVGWG follows up on their long-anticipated promise to move everything in the HTML namespace.

### Future extension allowing custom constructors

This proposal is largely designed around avoiding custom constructors. However, it's possible to allow them in the future with this proposal, if someone is willing to take the time to figure out all the issues around speccing and implementing them, with this proposal as an intermediate in the meantime.

The idea would be to expose `document.elementsRegistry.set(localName, C)`, which has the following notable characteristics:

- Enforces inheritance from `HTMLElement` (maybe allowing `SVGElement`?)
- Maybe disallow the `created` lifecycle hook?
- If the registry already contains an entry for `localName`, including one created automatically during parsing, the setting fails

The latter restriction is put in place to avoid having two "kinds" of `<x-foo>`s in the document: some that were created before `C` was registered, by the default parser-created one, and others that were created after `C` was registered, using `C`.
