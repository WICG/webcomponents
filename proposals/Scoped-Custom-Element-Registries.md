# Scoped Custom Element Registries

Author: [Justin Fagnani](https://github.com/justinfagnani)

## Introduction

This proposal allows for multiple custom element definitions for a single tag name to exist within a page. 

This is accomplished by allowing user code to create multiple custom element registries and associate them with shadow roots that function as scopes for element creation and custom element definitions. Potentially custom elements created within a scope use the registry for that scope to perform upgrades. New element construction APIs are added to ShadowRoot to allow element creation to be associated with a scope.

### Why do developers need scoped custom element registries?

It's quite common for web applications to contain libraries from multiple sources, whether from different teams, vendors, package managers, etc. These libraries must currently contend for the global shared resource that is the `CustomElementRegistry`. If more than one library (or more than one instance of a library) tries to define the same tag name, the application will fail. 

Multiple versions of a library is a common source of this problem. This can happen for many reasons, but there are a few application/library types where this is common:

1. **Any sized applications using npm:** NPM may install multiple versions of a library if it can't find a single version that satisfies version constraints (and it many cases where it could, but doesn't because of its lack of a version constraint solver). Thus an application may contain multiple definitions of a tag name from the same library, but at different versions.
2. **Large, complex applications:** These can have components authored by different teams, with loose coordination between them, built and deployed to production at different times. This makes library duplication in production common.
3. **Applications with plug-in architectures:** Some applications that allow plug-ins will run plug-ins in the main window. The application and plug-ins will typically be built and distributed independently. If the application and plug-in use the same component, they will have contention for the tag name.
4. **Browser Extensions:** Many browser extensions create DOM to be displayed in the main page. If this DOM is created with custom elements, they will need to be registered and could conflict with the page's scripts.

In addition to library duplication, there are other common use-cases for scopes:

1. **Third-party, CDN-hosted libraries:** Libraries like social-media share buttons and embeds, maps and documentation viewers, etc., can vend complex UI widgets that may need to register many elements, and they should not be using up a global namespace that they don't fully control.
2. **Internal implementation elements:** A component may have private internal elements that it needs to register, but would prefer not to leak to the external environment.

### Why use shadow roots as registration scopes?

Shadow roots provide an encapsulation mechanism for isolating a DOM tree's, nodes, styles, and events from other scopes. The goal is to allow scopes to function without required coordination with other scopes. The globally shared custom element registry, however, requires coordination so that multiple scopes on a page agree on the registrations. Rather than invent a new scoping primitive to the DOM, it is natural to extend the shadow root scoping responsibilities to include custom element registrations.

This approach also allows for a nice API by extending the DocumentOrShadowRoot interface and `ShadowRoot#attachShadow()`.

## Overview

This proposal allows user code to create new instances of `CustomElementRegistry`:

```js
const registry = new CustomElementRegistry();

and associate them with a ShadowRoot:

export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({mode: 'open', registry});
  }
}
```

Such scoped registries can be populated with element definitions, completely under the control of the registry owner:

```js
import {OtherElement} from './my-element.js';

registry.define('other-element', OtherElement);
```

Definitions in this registry do not apply to the main document, and vice-versa. The registry must contain definitions for all elements used.

Once a registry and scope are created, element creation associated with the scope will use that registry to look up custom element definitions:

```js
this.shadowRoot.innerHTML = `<other-element></other-element>`;
```

These scoped registries will allow for different parts of a page to contain definitions for the same tag name.

### Creating and using a CustomElementRegistry

A new CustomElementRegistry is created with the CustomElementRegistry constructor, and attached to a ShadowRoot with the `registry` option to `HTMLElement.prototype.attachShadow`:

```js
import {OtherElement} from './my-element.js';

const registry = new CustomElementRegistry();
registry.define('other-element', OtherElement);

export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({mode: 'open', registry});
  }
}
```

### Scoped element creation APIs

Element creation APIs, like `createElement()` and `innerHTML` can be grouped into global API (those on Document or Window) and scoped APIs (those on HTMLElement and ShadowRoot). The scoped APIs have an associated Node that can be used to look up a CustomElementRegistry and thus a scoped definition.

In order to support scoped registries we add new scoped APIs, that were previously only available on `Document`, to `ShadowRoot`:

* `createElement()`
* `createElementNS()`
* `importNode()`

These APIs work the same as their Document equivalents, but use scoped registries instead of the global registry.

### Registry Inheritance

In a shadow root with a scoped registry, all element creation APIs use that shadow root's registry, and not the document's, to look up definitions. To inherit definitions from the global, or another scoped registry, a parent registry can be passed in at construction time:

```js
const registry = new CustomElementRegistry({
    parent: window.customElements,
});
```

This inheritance is live. New registrations added to the parent registry are available to inheriting registries. This is useful in the case where an element is already written to use the global registry, but needs to register a private helper element, or override only a single element in conflict with the global. It may also be useful in plug-in architectures where the host program provides a number of elements to plugins.

For non-live inheritance, we can add a method to CustomElementRegistry that returns all of its registrations:

```js
const registry = new CustomElementRegistry({
    definitions: {
      ...window.customElements.getDefinitions(),
      'local-element': LocalElement,
    }
});
```

### Finding a custom element definition

Because there is no longer a single global custom element registry, when creating elements, the steps to look up a custom element definition need to be updated to be able to find the correct registry.

That process needs to take a context node that is used to look up the definition. The registry is found by getting the context node's root. If the root has a CustomElementRegistry, use that registry to look up the definition, otherwise use the global objects CustomElementRegistry object.

The context node is the node that hosts the element creation API that was invoked, such as `ShadowRoot.prototype.createElement()`, or `HTMLElement.prototype.innerHTML`. For `ShadowRoot.prototype.createElement()`, the context node and root are the same.

#### Note on looking up registries

One consequence of looking up a registry from the root at element creation time is that different registries could be used over time for some APIs like HTMLElement.prototype.innerHTML, if the context node moves between shadow roots. This should be exceedingly rare though.

Another option for looking up registries is to store an element's originating registry with the element. The Chrome DOM team was concerned about the small additional memory overhead on all elements. Looking up the root avoids this.

### Custom element constructors

Constructors need special care with scoped registries. With a single global registry there is a strict 1-to-1 relationship between tag names and constructors. Scoped registries change this by allowing the same tag name to be associated with multiple constructors, which is solved by the altered look up a custom element definition process allowing the browser to find the correct constructor given a tag name.

In the other direction, we want to be able to call `new MyElement()`, which means we need to be able to locate the correct tag name from a constructor as well.

The way this is done is by limiting constructors by default to only looking up registrations from the global registry. If the constructor is not defined in the global registry, it will throw. In order to get a constructor that creates a scoped definition, customElementRegistry.define() returns a new constructor:

```js
import {OtherElement} from './my-element.js';

const registry = new CustomElementRegistry();

// define() returns a new class:
const LocalOtherElement = registry.define('other-element-2', OtherElement);
const el = new LocalOtherElement();
el.tagName === 'other-element-2';

// The same class is available from registry.get():
const O = registry.get('other-element-2')
const el2 = new O();
el2.tagName === 'other-element-2';
```

The constructor returned by `define()` is from a trivial subclass of the registered class.

### Sugar for bulk registrations

To make importing and registering multiple definitions easier, the CustomElementRegistry constructor can take an object containing multiple definitions:

```js
import {ElementOne} from './element-one.js';
import {ElementTwo} from './element-two.js';

const registry = new CustomElementRegistry({
  definitions: {
    'element-one': ElementOne,
    'element-two': ElementTwo,
  }
});

export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({mode: 'open', registry});
  }
}
```

## API

### CustomElementRegistry

#### Constructor

The CustomElementRegistry constructor creates a new instance of CustomElementRegistry, independent of the instance available at `window.customElements`.

##### Syntax

```js
const registry = new CustomElementRegistry({parent, definitions});
```

##### Parameters
parent A parent CustomElementRegistry to inherit definitions from.
definitions An object whose keys are custom element names and values are the associated constructors.

### ShadowRoot

ShadowRoot adds element creation APIs that were previously only available on Document:

* `createElement()`
* `createElementNS()`
* `importNode()`

These are added to provide a root and possible registry to look up a custom element definition.

##  Alternatives to allowing multiple definitions

### More robust registration patterns

To solve the problem of double-defining compatible versions of the same tag name, one could use a registration pattern with error handling:

```js
try {
  customElements.define(tagName, ctor, options);
} catch (e) {
  // Hope the definitions are compatible and continue
}
```

However, there is no way to determine if the definitions are compatible. The resulting application execution may have subtle bugs.

### Iframes

Developers can technically already create new custom element scopes with iframes. Iframes also create new documents, style scopes, JavaScript realms and possibly security contexts. So they may indeed be better suited for some plug-in use-cases. But to be useful in the npm and complex application use-cases, at the limit every component would need to be in an iframe.
