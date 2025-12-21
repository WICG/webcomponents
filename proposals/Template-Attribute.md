# HTML Template `template-` Attribute

## Introduction

The following proposal describes an alternate method of providing dynamic data to an HTML template element as compared to [DOM Parts] and [Template Instantiation]. It does so by introducing a new `template-` attribute prefix which acts similar to the classic [dataset] attributes but has defined behavior only when used inside a ShadowRoot and a new read-only `templates` property of ShadowRoot that returns a DOMStringMap which allows writing to a child element's properties.

One of the benefits of this approach is that it removes the need for standardizing any special syntax. Another is that it fully supports client-side and server-side rendering, with and without hydration.

## Proposal

The syntax of a template attribute looks like this: `template-[PROPERTY_KEY]="[TEMPLATE_KEY]"`

Each template attribute identifies two pieces of information: the property key and template key. The property key identifies an attribute that should be set to the value identified by the template key. Property keys are an element's camel-cased property name converted to lowercase. Template keys should follow the same naming rules as dataset names.

Although template attributes can be accessed like normal attributes, they are primarily intended to be controlled using the `templates` property on a ShadowRoot. This helps prevent any conflicts caused by nesting. Element attributes should not be created or modified directly; instead, when a value in `templates` is set, any element with the corresponding `template-` attribute should have its attribute (minus the `template-` prefix) set to this value.

For example, consider this HTML:

```html
<template id="foo">
    <p><span template-class="styles" template-innertext="msg"></span></p>
</template>
```

After executing this JavaScript:

```js
const shadowRoot = this.attachShadow({ mode: "open" });
shadowRoot.appendChild(document.querySelector("#foo").content.cloneNode(true));

shadowRoot.templates.styles = "red bold";
shadowRoot.templates.msg = "Hello, World!";
```

The result would be:

```html
<p><span template-class="styles" template-innertext="msg" class="red bold">Hello, World!</span></p>
```

## SSR Note

In addition, there may be use cases in which the server-rendered HTML is intended to be final. Unlike the alternatives, this allows applications the option of optimizing by removing unneeded HTML. Consider this example:

```html
<p>Hello, <span template-class="color"><span template-innertext="name"></span></span></p>
```

If `color` is set to `"red"` and `name` is set to `"Bob"`, the final result might look something like this:

```html
<p>Hello, <span class="red" template-class="color"><span template-innertext="name">Bob</span></span></p>
```

This is fine for both client-side rendering and server-side rendering with hydration, but what if the template is only meant to be rendered once, like in a static site generator? In that case, it would be better to remove any template markup to reduce total size and network transmission time.

```html
<p>Hello, <span class="red"><span>Bob</span></span></p>
```

[DOM Parts]: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md
[Template Instantiation]: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md
[dataset]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
