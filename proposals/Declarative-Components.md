# Declarative Components

### Problem
Today to create a web component we have to write a piece of JavaScript code just
to register a custom element. Web component needs to give a next step. If we
want people to use it more we should let them create small components without
friction.

A declarative way to define custom elements appears to solve the problem above.
Some proposals has already been made, but apparently, none has evolved.

### Proposal

This proposal introduces the new tag `<component>` to HTML.

A component may be composed of three parts: template, style and script.
None of them are required.

```html
<component name="badge-number" extends="span">
  <template>
  </template>

  <style>
  </style>

  <script>
  </script>
</component>
```

Today, browsers automatically creates a `#document-fragment` for every `<template>` tag it finds.

This proposal suggest browsers to:

1. create a `#document-fragment` for every `<component>` element it finds.
2. automatically register a custom element as soon as it parses a `<component>` element.

Registering a component have four steps:
1. register the template
2. register the root element
3. register the style
4. register the script

#### The template
A web component can have only one `<template>` tag inside. It is not required.

#### The Root Element
If the component `extends` from another element and does not have a `<template>` it should
create a template inside the component with the extended element as the root element and an empty slot inside.

#### The style
A web component can have only one `<style>` tag inside. It is not required.

#### The script
A web component can have only one `<script>` tag inside. It is not required.
The script must have one class implemented and extending from another element, exemple: HTMLElement.

The last step is register the custom element.

If the component have a `<script>`, then it should register the custom element with **main class** extending
from the class implemented on `<script>`, otherwise, it should register with main class extending from **HTMLElement**.

The code bellow is the **main class** that register the custom element. Note how it `extends`.

```javascript
let componentsClass = hasScript ? ClassFromScript : HTMLElement;

class extends componentsClass {
  constructor(...args) {
    const self = super(...args);

    let template = component.getElementsByTagName('template')[0];
    if (template) {
      let templateContent = template.content;
      const shadowRoot = this.attachShadow({mode: 'open'})
                             .appendChild(templateContent.cloneNode(true));
    }

    this.propagateAttributes()

    return self;
  }
}
```

The full implementation of the polyfill is straightforward. You can see it
[here](https://github.com/emanuelhfarias/tag-components/blob/master/component-polyfill.js)


#### Propagating Atrributes

The last part happens when the custom element is appended in the DOM and the constructor is called.
It will propagate all attributes from the custom tag to the root element of the component.
The propagation is necessary so the styles based on those attributes could be applied.
If the propagation does not happen, it will be necessary to style based on `:host()`, which is not convenient
for most people.

# The Polyfill

An experiment polyfill is been development [here](https://tag-components.vercel.app/).
There you can find several live examples using the polyfill.