# Type Extensions

This document explores the pros and cons of various options for instantiating a custom element as an extension of a native element.

## Potential benefits of type extensions

### Access to native element behaviour

#### Accessibility

* **Implicit semantics** - Using a type extension means - in most cases - that you get the semantics of the extended element without doing any extra work. This is discussed in detail [in the spec](http://w3c.github.io/webcomponents/spec/custom/#semantics).
* **Non-ARIA semantics** - There are semantics which currently can't be expressed using ARIA, such as a _paragraph_ role.
* **Focusability** - For interactive widgets, type extended elements inherit the native element's focusability without needing to add a `tabindex` attribute. (Note: there is [ongoing work](https://docs.google.com/document/d/1k93Ez6yNSyWQDtGjdJJqTBPmljk9l2WS3JTe5OHHB50/edit?pli=1) to add this behaviour as a primitive.)
* **Keyboard events** - If not adding a shadow root, you also get the native keyboard event handling.
* **Platform-specific presentation** - If not adding a shadow root, you can access platform-specific presentation such as the varying appearance of `<input type=date>`.

##### Accessibility nuances

There are several nuances to the accessibility argument which should be kept in mind when discussing pros and cons from an accessibility point of view.

* **Primitives vs UI patterns** - Type extensions may help to solve two related but distinct problems in accessibility, which should be considered separately:
  * Access to semantics currently only available to native elements. Over time, we _should_ develop alternative mechanisms for expressing the full range of semantics available to the web platform and to the assistive technology APIs; however, these mechanisms may take an arbitrarily long time to be realised.
  * Inheritance of the full complement of accessibility-related attributes and behaviours built in to a native element. The main issue we see with accessibility on the web today is that even when the necessary primitives _are_ available (ARIA attributes, JavaScript keyboard event handling, etc.), developers don't use them. From an accessibility standpoint, our best advice is to use native elements where possible, since this represents the minimal amount of work to get the most robust accessibility. In the case of Web Components, the analogous advice should be to extend a native element.
* **Replaced shadow root behaviour** - When the native shadow root is replaced, some of the built-in accessibility and behaviour is lost. This is particularly true for composite semantic roles (see below).
* **Stand-alone vs composite semantic roles** - (Note: the term 'roles' here applies equally to any semantic role which an element may fill, regardless of whether specified as an ARIA attribute or implicit)
  * Some [widget roles](http://www.w3.org/TR/wai-aria/roles#widget_roles), such as `button`, are _stand-alone roles_, meaning that it suffices to add that role to a single element, and then its descendant content is used largely for text alternative computation. These atomic roles represent the 'best case' for inheriting semantics from a native element.
  * Other roles, such as `listbox`, are _composite roles_, meaning that there may be several interactive elements within the element with that role. `<input type=date>` is a very special case of a composite role, since it doesn't have a pre-defined structure for its (browser-provided) descendant content, but always has several interactive elements within it; plus, it is rendered very differently on different platforms. 

#### Forms behaviour

* Only native forms element may be submitted as part of a standard `<form>`. A developer may do either or a combination of:
  * extend native form elements in order to have custom behaviour or appearance for those elements, or 
  * extend `<form>` to pick up values from custom elements before submitting. 

#### Script-supporting element behaviour

* `<script>` and `<template>` have behaviour which cannot be expressed any other way; until if and when the necessary primitives are developed, custom elements must extend these elements in order to get this behaviour.

### Progressive enhancement

## `is`

The [current proposal](http://www.w3.org/TR/custom-elements/#dfn-type-extension) is to use the `is` attribute on a native HTML tag to specify the custom element type:

```html
<button is="x-button">x-button content</button>
```

### Benefits of `is`

#### Can be implemented in browsers immediately

#### Progressive enhancement

### Drawbacks

* **Stands inheritance on its head** - The main issue with the `is=` proposal is
    takes the concept of inheritance developers are familiar with and stands it
    on its head.
    
    The idea with inheritance is that you build new object from other ones,
    conceptually, the object you build from become attributes of the object
    you are building, so for example:
    
    ```html
    <my-button extends=button>
    ```
    
    …makes a lot of sense. Clearly, you're building a new element that
    extends the capabilities of the existing button object.
    
    With the `is=` syntax, however, what it is you're doing isn't clear at all:
    
    ```html
    <button is=my-button>
    ```
    
    What's the message here? Is this just a button? Oh no, it's not a
    button… it's a `my-button`. But does it actually inherit from button?
    That's unclear from the syntax. 

* **Hard to spot when scanning code** - As soon as you add a number
    of extra attributes in the mix, finding out what the element
    actually is becomes a lot more involved.
    
    ```html
    <button value="45" class="button button-large" is="my-button" id="cta" />
    ```

* **Error prone (doesn't express intent)** - There's a concern developers will mistakenly write:
    
    ```html
    <my-button is=button>
    ```
    instead of
    
    ```html
    <button is=my-button>
    ```
    
    as it is much closer in form to the conceptual inheritance model
    they have in mind (anecdotical evidence confirms this is already an issue).

## Alternative proposals

In "drawbacks' above, the objections to the syntax that inheritence is turned on its head an it's error prone could be ameliorated by changing the syntax, eg 

    ```html
    <button extendedby=my-button>
    ```
 
The objection that it's hard to scan is equally the case with

    ```html
    <my-button tabindex="-1" some-unknown-attribute="7829" and-another-one="hkha">
    ```
 
 That requires delving into some JS to see what it actually does. (I assume it's trivial for browser devtools/ syntax-highlighter to highlight an element with an extendedby/ is arribute to draw a developer's attention to it).
