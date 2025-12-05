# Reference Target for Cross-Root ARIA

Original proposal author: [Ben Howell](https://github.com/behowell)

## Introduction

Reference Target allows attributes referring to a component host element to be forwarded to one or more elements inside its shadow DOM,
while strictly maintaining the encapsulation guarantees provided by shadow DOM.
The motivating goal of this feature is to enable [ARIA relationship attributes](https://www.w3.org/TR/wai-aria-1.3/#attrs_relationships)
to work across shadow root boundaries.

This proposal is based on [@Westbrook](https://github.com/Westbrook)'s [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) proposal, as well as borrowing ideas from [@alice](https://github.com/alice)'s [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) proposal.

## Background

A shadow root creates a [separate node tree](https://dom.spec.whatwg.org/#shadow-trees),
while ID references like the value of the label element's [`for` attribute](https://html.spec.whatwg.org/#attr-label-for)
can only refer to elements in the same node tree.
IDL attributes like [`popoverTargetElement`](https://html.spec.whatwg.org/#dom-popovertargetelement) are also able to 
[refer to elements](https://html.spec.whatwg.org/#reflecting-content-attributes-in-idl-attributes:element)
in trees whose root is a shadow-including ancestor of their containing shadow root
(i.e. these attributes can "refer out" of shadow roots).

<img width="699" height="333" alt="Examples of the types of references described above. See below for detailed description." src="https://github.com/user-attachments/assets/10e5786f-abb4-4c0e-b467-49feb655d7bf" />

<details><summary>Detailed description of diagram</summary>
A document tree with annotations:

- Document
  - Element: label for="sibling"
  - Element: input id="sibling" (annotation: an arrow from the previous element to this one, saying "Allowed - same tree")
  - 
  - Element: label id="light"
  - Element: custom-input
    - Shadow root
      - Element: input ariaLabelledByElements=[light] (annotation: an arrow from this element to the preceding label, saying "Allowed - ancestor tree")
  - 
  - Element: label for="shadow"
  - Element: custom-input
    - Shadow root
      - Element: input id="shadow" (annotation: an arrow from the preceding label, saying "DISALLOWED - can't refer in to shadow tree")
     
</details>

There are varied scenarios in which developers need to create cross-shadow root references.

### Components which enclose existing elements to add functionality via composition

This technique has emerged in web component authoring as a way to reuse the functionality of built-in elements while encapsulating styling and other specialisations.
These elements are typically intended to be used in place of elements they enclose.

#### `sp-checkbox`

For example, Spectrum Web Components' [`sp-checkbox` component](https://opensource.adobe.com/spectrum-web-components/components/checkbox/)
composes an `<input type=checkbox>`,
augmenting its functionality in several ways including adding an `indeterminate` content attribute:

<img width="597" height="254" alt="Screenshot of the sp-checkbox documentation section on the `indeterminate` state" src="https://github.com/user-attachments/assets/c0006adc-57a3-4829-8cbe-fd0ae054bd62" />

In this example, when the author uses the component like this:

```html
<sp-checkbox indeterminate>Indeterminate</sp-checkbox>
```

The component encapsulates a visual rendering for an indeterminate state with a built-in `<input type=checkbox>`
with the [`indeterminate` IDL attribute](https://opensource.adobe.com/spectrum-web-components/components/checkbox/) set,
which handles click and keyboard events
as well as being labelable and benefiting from `<label>` element behaviour such as toggling when the label is clicked.

```html
<sp-checkbox indeterminate="" dir="ltr" tabindex="0">
  #shadow-root
  | <input id="input" type="checkbox"> <!-- has .indeterminate IDL attribute set -->
  | <span id="box"><!-- partial checkmark rendering --></span>
  | <label id="label" for="input">
  |   <slot></slot>
  | </label>
Indeterminate
</sp-checkbox>
```


This example also illustrates one of the fundamental limitations of this technique:
it's not quite a drop-in replacement for `<input type="checkbox">` because page authors can't use `<label>` as they normally would,
without doing significant extra work to make the custom element [form-associated](https://html.spec.whatwg.org/multipage/custom-elements.html#form-associated-custom-element)
(which seems particularly burdensome when there is a perfectly good `<input>` right there);
instead, the component has to include the `<label>` in its shadow DOM so that the association can be set up.

#### `md-dialog`

Another example of this technique is Material Web Components' [`md-dialog`](https://material-web.dev/components/dialog/),
which encloses a `<dialog>` element,
enhancing it with pre-defined styles and animations, with slots for a headline, content and actions,
with features to emulate modal dialog behaviour even when `openModal()` isn't used,
and with API features which make the dialog easier to use.

<img width="363" height="373" alt="Screenshot of a dialog headlined 'Choose your favorite pet', with radio buttons labelled 'Cats', 'Dogs' and 'Birds', and buttons labelled 'Cancel' and 'Ok'." src="https://github.com/user-attachments/assets/06ad1b4b-fc09-4737-b38d-80af105da49d" />

The author can create the above component like this: 

```html
<md-dialog>
  <div slot="headline">Choose your favorite pet</div>
  <form id="form" slot="content" method="dialog">
    <label>
      <md-radio name="pet" value="cats" checked></md-radio>
      <span>Cats</span>
    </label>
    <!-- Similar items for "Dogs" and "Birds" -->
  </form>
  <div slot="actions">
    <md-text-button form="form" value="cancel">Cancel</md-text-button>
    <md-text-button form="form" autofocus value="ok">OK</md-text-button>
  </div>
</md-dialog>
```

The author-provided content is slotted into the `<dialog>` inside the component's shadow DOM:

```html
<md-dialog>
  #shadow-root
  | <div class="scrim"></div> <!-- emulate modal dialog ::backdrop -->
  | <dialog aria-labelledby="headline" open>
  |   <div class="focus-trap" tabindex="0" aria-hidden="true"></div> <!-- emulate focus trapping behaviour -->
  |   <div class="container">
  |     <h2 id="headline">
  |       <slot name="headline"></slot>
  |     </h2>
  |     <div class="scroller">
  |       <slot name="content"></slot>
  |     </div>
  |     <div class="actions">
  |       <slot name="actions"></slot>
  |     </div>
  |   </div>
  |   <div class="focus-trap" tabindex="0" aria-hidden="true"></div>
  | </dialog>
  <!-- Author-provided content as shown above -->
</md-dialog>
```

Since the `<dialog>` is inside the shadow root,
the `<md-dialog>` element can't be used with [`commandFor`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#commandfor),
but requires authors to use JavaScript to open and close the dialog,
either by setting its `open` attribute or by using the `show()` and `close()` methods.

### Referring to specific elements within a component's shadow DOM

There are also cases where authors need to refer to specific elements within a component's shadow DOM.
This is distinct from the cases above, where the component _as a whole_ is expected to behave comparably to the element it has enclosed.

#### `aria-activedescendant` and comboboxes

[`aria-activedescandant`](https://w3c.github.io/aria/#aria-activedescendant) allows authors to convey to assistive technologies,
such as screen readers,
that an element other than the one which has keyboard focus is "active" and immediately relevant to the user.

This is canonically used for [accessible comboboxes](https://sarahmhigley.com/writing/activedescendant/#when-to-use-aria-activedescendant)
(or, more generally, accessible autocomplete patterns):
keyboard focus must necessarily be on the text input, so that the user can continue to type into it,
but the user also needs to know which autocomplete option has been selected in order to commit an autocompletion.

<img width="944" height="460" alt="image of an open combobox labeled best pet, with screaming hairy armadillo selected. The image is marked up: the input is highlighted and labeled as the focused element, and the screaming hairy armadillo option inside the open listbox popup is highlighted and labelled activedescendant" src="https://github.com/user-attachments/assets/55392ef1-4cb4-40fc-89b1-99062f8d8fd0" />

(Image and description by Sarah Higley, from https://sarahmhigley.com/writing/activedescendant/)

These components typically consist of a text input and a listbox containing the autocomplete option,
using `aria-controls` to establish the link between the text input and the list,
and `aria-activedescendant` to mark the selected option as the active "descendant" of the text input.

```html
<input type="text" aria-controls="listbox" aria-activedescendant="opt2">
<div role="listbox" id="listbox">
  <div role="option" id="opt1">Otter</div>
  <!-- this is a descendant of the listbox, which is pointed to by aria-controls, so it is OK -->
  <div role="option" id="opt2">Opossum</div>
  <div role="option" id="opt3">Ocelot</div>
</div>
```

(Code example from https://sarahmhigley.com/writing/activedescendant/#when-to-use-aria-activedescendant#how-to-use-aria-activedescendant)

In certain circumstances, the listbox component needs to enclose its options inside its shadow root:

```html
<input role="combobox" type="text" aria-controls="listbox" aria-activedescendant="???">
<animals-listbox id="listbox">
  #shadow-root
  | <div role="listbox" id="listbox">
  |   <div role="option" id="opt1">Otter</div>
  |   <div role="option" id="opt2">Opossum</div>
  |   <div role="option" id="opt3">Ocelot</div>
  | </div>
</animals-listbox>
```

Note that, in this case, the selected `option` is conceptually a descendant of the `<input>`,
but may be in a separate shadow root in order to allow separate re-use of the listbox component.
However, the relationship truly is between the `<input>` and the `option`,
in addition to that between the `<input>` and the `listbox`.

#### Fine-grained `aria-labelledby` and `aria-describedby`

[`aria-labelledby`](https://w3c.github.io/aria/#aria-labelledby) and [`aria-describedby`](https://w3c.github.io/aria/#aria-describedby)
allow authors to refer to one or more elements in order to create an accessible name or accessible description for an element, respectively.

Occasions can arise where authors need to refer to elements _within_ a component
to be used as an accessible name or description for another element.
This can happen because the logical encapsulation grouping for component _behaviour_
can result in elements whose [text equivalent](https://www.w3.org/TR/accname-1.2/#mapping_additional_nd_te)
wouldn't be a useful addition to the name of the element to be labelled,
even if the rest of the component is.

## Goals

1. Allow web components [enclosing an element](#components-which-enclose-existing-elements-to-add-functionality-via-composition)
   in order to compose capabilities on top of it
   to function equivalently to the enclosed element when used as a target for IDREF-based content attributes
   or their equivalent
   [IDL attributes](https://html.spec.whatwg.org/#reflecting-content-attributes-in-idl-attributes:reflected-idl-attribute-32).
3. Allow finer-grained references to be created to
   [specific elements within a shadow root](#referring-to-specific-elements-within-a-components-shadow-dom).

Any solution should:

1. Be serializable.
2. Work for both closed and open shadow roots.
3. Preserve shadow DOM encapsulation.

## Non-goals

The following are real and interesting problems, but out of scope for this work:

1. Allow attributes on the host to be "forwarded" to the [enclosed element](#components-which-enclose-existing-elements-to-add-functionality-via-composition).
   - For example, to allow `role` or `aria-label` on the host to be applied to the enclosed element.
2. Straightforward form association for enclosed [form-associated](https://html.spec.whatwg.org/multipage/forms.html#form-associated-element) elements. 
3. Provide a serializable way to create references from elements in shadow DOM to elements in light DOM.

## Proposal: Reference Target

Reference Target is a new feature that enables references to the host element to be forwarded to an element inside a component's shadow DOM, 
while maintaining encapsulation of the internal details of the shadow DOM.

#### Phases

This proposal is broken into two phases:

- [Phase 1](#phase-1) addresses [enclosing elements](#components-which-enclose-existing-elements-to-add-functionality-via-composition)
- [Phase 2](#phase-2) addresses [finer-grained references](#referring-to-specific-elements-within-a-components-shadow-dom).
  
The goal of breaking it into phases is to get the more straightforward and better-understood use cases working first.
The problems Phase 2 aims to address are less well-understood and more complex,
and may need more experience and discussion before we can be confident in any proposed solution.

### <a id="phase-1"></a> Phase 1: ShadowRoot `referenceTarget` attribute

A component can specify an element in its shadow tree to act as its "reference target".
When the host component is the target of a IDREF, like a label's `for` attribute, the referenceTarget becomes the effective target of the label.
This allows a host element to substitute for an [enclosed element](#components-which-enclose-existing-elements-to-add-functionality-via-composition)
for the purposes of those attributes.

The shadow root specifies the ID of the target element inside the shadow DOM. This is done using one of the following methods:
* The `referenceTarget` entry in the `ShadowRootInit` argument to `attachShadow()`.
* The `referenceTarget` attribute on the `ShadowRoot` object.
* In HTML markup using the `shadowrootreferencetarget` attribute on the `<template>` element.

This can improve the experience of using the components described in the [Background section](#background):

[`sp-checkbox`](#sp-checkbox), demonstrating the JavaScript API options:

```html
<script>
  customElements.define(
    "sp-checkbox",
    class Checkbox extends HTMLElement {
      checked = "mixed";
      
      constructor() {
        super();
        this.shadowRoot_ = this.attachShadow({ 
          mode: "closed",
          referenceTarget: "input",
        });

        // Optionally, set referenceTarget on the ShadowRoot object.
        // Not needed in this case since it was set in attachShadow() instead.
        // this.shadowRoot_.referenceTarget = "input";

        this.render()
      }
      render() {
        this.shadowRoot_.innerHTML = `
            <input id="input"
                   type="checkbox"
                   ${this.checked == "true" ? "this.checked" : ""}
                   aria-checked=${this.checked == "indeterminate" ? "mixed" : this.checked}>
            <span id="box"></span>`;
      }
    }
  );
</script>

<label for="consent">I consent to cookies</label>
<sp-checkbox id="consent"></sp-checkbox>
```

[`md-dialog`](#md-dialog), demonstrating the declarative shadow DOM option:

```html
<button commandFor="pets">
<md-dialog id="pets">
  <template shadowRootMode="open"
            shadowRootReferenceTarget="dialog">
    <div class="scrim"></div> <!-- emulate modal dialog ::backdrop -->
    <dialog id="dialog" aria-labelledby="headline">
      <div class="focus-trap" tabindex="0" aria-hidden="true"></div> <!-- emulate focus trapping behaviour -->
      <div class="container">
        <h2 id="headline">
          <slot name="headline"></slot>
        </h2>
        <!-- Other dialog components as shown above -->
      </div>
      <div class="focus-trap" tabindex="0" aria-hidden="true"></div>
    </dialog>
  </template>

  <div slot="headline">Choose your favorite pet</div>
  <!-- Other content as shown above -->
</md-dialog>
```

#### Supported attributes

This feature is intended to work with **all** attributes that refer to another element by ID string. These are:

- ARIA
  - `aria-activedescendant`
  - `aria-controls`
  - `aria-describedby`
  - `aria-details`
  - `aria-errormessage`
  - `aria-flowto`
  - `aria-labelledby`
  - `aria-owns`
- Inputs
  - `for` (also supports the click behavior of labels)
  - `form`
  - `list`
  - `popovertarget`
  - `anchor` (proposed in the [Popover API Explainer](https://open-ui.org/components/popover.research.explainer/#anchoring))
  - `commandfor` (proposed in [Invokers Explainer](https://open-ui.org/components/invokers.explainer/))
  - `interesttarget` (proposed in [Invokers Explainer](https://open-ui.org/components/invokers.explainer/))
- Tables
  - `headers`

> _Please comment if there are any attributes missing from this list._

#### Live references

Reference targets are a "live reference". Any of the following changes could result in an element reference being updated:
* The host changes its `referenceTarget` to refer to a different ID.
* An element with an `id` that matches its host's referenceTarget is added to or removed from the host's shadow tree.
* The `id` attribute of an element inside the host's shadow tree is changed to or from the referenceTarget ID.
* The host is added or removed from the DOM.
* The host's `id` attribute is changed.

#### Interaction with other features

##### Interaction with CSS Selectors

The referenceTarget does not affect CSS selectors in any way. An ID selector will target the host element that has the matching `id` attribute, and _not_ its referenceTarget.

##### Form-associated custom elements

A [form-associated custom element](https://html.spec.whatwg.org/dev/custom-elements.html#form-associated-custom-element) supports being the target of a label's `for` attribute. But if the element has a Reference Target for the `for` attribute, then the label applies to the target instead. There are no other changes to the behavior of a form-associated custom element.

##### Nesting inside `<label>`

Reference Target allows for labels to be implicitly associated with the target element when the host is nested inside a `<label>` element. The shadow tree's reference target will be associated with the label that contains the element. 
In the following example, the label of the `<input id="real-input">` is "Fancy input".

```html
<script>
  customElements.define(
    "fancy-input",
    class FancyInput extends HTMLElement {
      constructor() {
        super();
        this.shadowRoot_ = this.attachShadow({ 
          mode: "closed",
          referenceTarget: "real-input",
        });
        this.shadowRoot_.innerHTML = `<input id="real-input" />`;
      }
    }
  );
</script>

<label>
  Fancy input
  <fancy-input></fancy-input>
</label>
```

##### Nesting inside `<form>`

Reference target does not change the behavior of the host element when it is nested inside a form. It does _not_ implicitly associate the target element with the form if it is not a form-associated custom element.

##### JavaScript attributes that reflect `Element` objects

Some JavaScript attributes reflect HTML attributes as Element objects rather than ID strings. These include:

- `ARIAMixin.ariaActiveDescendantElement`
- `ARIAMixin.ariaControlsElements`
- `ARIAMixin.ariaDescribedByElements`
- `ARIAMixin.ariaDetailsElements`
- `ARIAMixin.ariaErrorMessageElements`
- `ARIAMixin.ariaFlowToElements`
- `ARIAMixin.ariaLabelledByElements`
- `ARIAMixin.ariaOwnsElements`
- `HTMLButtonElement.interestTargetElement`
- `HTMLButtonElement.popoverTargetElement`
- `HTMLElement.anchorElement`
- `HTMLInputElement.form`
- `HTMLInputElement.labels`
- `HTMLInputElement.list`
- `HTMLLabelElement.control`

These will _never_ directly return the referenceTarget element that's inside the shadow tree. This is because an [IDL attribute with type Element](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes:element) can only refer to an element that is a descendant of a [shadow-including ancestor](https://dom.spec.whatwg.org/#concept-shadow-including-ancestor) of the element hosting the attribute.

Instead, most attributes return the **host** element that they're targeting, as long as the attribute's expected type is compatible.

> The `.form` and `.list` attributes are currently specced to be `HTMLFormElement` or `HTMLDataListElement`,
> so they should be updated so the host element can be returned.

In the example below, `input.ariaControlsElements` is the `<fancy-listbox>` element that was targeted by `aria-activedescendant="fancy-listbox"`, even though the active descendant internally targets `<div id="option-2">`.

```html
<input id="input" aria-controls="fancy-listbox" />
<fancy-listbox id="fancy-listbox">
  <template
    shadowrootmode="open"
    shadowrootreferencetarget="real-listbox"
  >
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>

<script>
  const input = document.getElementById("input");
  console.log(input.ariaControlsElements);
  // Logs: [<fancy-listbox id="fancy-listbox">]
</script>
```

##### Interaction with `HTMLInputElement.labels` and `ElementInternals.labels`

The [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) attribute returns a list of the label elements targeting a certain input element. This API should continue to work if the input element is itself the target of a custom element. The labels will be in [shadow-including tree order](https://dom.spec.whatwg.org/#concept-shadow-including-tree-order).

Since custom elements inherit from `HTMLElement` and _not_ `HTMLInputElement`, they don't have a `labels` attribute. However, if the custom element is form-associated _and_ has a `referenceTarget`, then [`ElementInternals.labels`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/labels) will return an empty list `[]`, since all labels are forwarded to the reference target and not associated with the custom element itself.

```html
<script>
  customElements.define(
    "form-input",
    class FormInput extends HTMLElement {
      static formAssociated = true;
      constructor() {
        super();
        this.attachShadow({
          mode: "open",
          referenceTarget: "real-input",
        });
        this.internals = this.attachInternals();
        this.shadowRoot.innerHTML = `
        <label id="inner" for="real-input">Inner</label>
        <input id="real-input" />
      `;
      }
    }
  );
</script>

<label id="before" for="form-input">Before</label>
<form-input id="form-input"></form-input>
<label id="after" for="form-input">After</label>

<script>
  const formInput = document.getElementById("form-input");
  console.log(formInput.labels);
  // undefined
  console.log(formInput.internals.labels);
  // []

  const realInput = formInput.shadowRoot.getElementById("real-input");
  console.log(realInput.labels);
  // [<label id="before">, <label id="inner">, <label id="after">]
</script>
```

### <a id="phase-2"></a> Phase 2: referring to specific elements within a shadow root

In order to allow [referring to specific elements](#referring-to-specific-elements-within-a-components-shadow-dom)
within a component's shadow root without leaking implementation details,
there are a few avenues we could take:

1. Address individual use-cases separately rather than create a generic mechanism 
2. Allow the host to declare "parts" which may be referred to by name when using IDREF-based attributes
3. Expand `referenceTarget` to allow references to the host to be forwarded to different elements

#### Addressing individual use-cases separately

Depending on what actual needs authors have in practice to refer to specific elements inside shadow DOM,
it may make more sense to address these needs on a more piecemeal basis
rather than developing an API intended to be general-purpose.

For example, rather than developing a mechanism to allow `aria-labelledby` and/or `aria-describedby` references
to be made to specific elements within a component, 
it might be preferable for a component to be able to specify how its text alternative should be computed.

And, it may make sense to [allow `aria-activedescendant` to be computed transitively](https://github.com/w3c/aria/issues/1500),
at least in some situations.

#### Exposing "parts" to IDREF-based attributes: `exportid`

An earlier proposal, [`exportid`](https://github.com/WICG/aom/blob/gh-pages/exportid-explainer.md),
was based on the idea of allowing a component author to mark a given element as having an "exported" ID,
which could be used by elements outside of the shadow root to refer to that element
without leaking any details about the component's internal structure other than the existence of an element with that ID.

This design was based on [CSS `::part()`](https://developer.mozilla.org/en-US/docs/Web/CSS/::part),
which also allows targeting specific elements within shadow roots.

This could be used in the [combobox](#aria-activedescendant-and-comboboxes)
scenario in conjunction with `referenceTarget` to allow the `<input>` to refer separately to the `listbox` element
and the active `option`:

```html
<input role="combobox" type="text" aria-controls="listbox" aria-activedescendant="listbox::id(active)">
<animals-listbox id="listbox>
  <template shadowRootMode="open"
            shadowRootReferenceTarget="listbox">
    <div role="listbox" id="listbox">
      <div role="option" id="active" exportid>Otter</div>
      <div role="option">Opossum</div>
      <div role="option">Ocelot</div>
    </div>
  </template>
</animals-listbox>
```

#### Expanding `referenceTarget`: ShadowRoot `referenceTargetMap` attribute

The `ShadowRoot.referenceTargetMap` attribute allows for specifying target elements based on the attribute that is being used to reference the host.

This attribute would allow references to the host element to be forwarded to different elements inside of its shadow root,
based on the attribute used to refer to the host.
This would allow [references to be made to specific elements other than the primary reference target](#referring-to-specific-elements-within-a-components-shadow-dom)
inside a component's shadow root,
when the component author has anticipated the need for that attribute to refer to that element.

The equivalent declarative attribute is `shadowRootReferenceTargetMap`, which is a comma-separated list of attribute to ID mappings.

> Note: the syntax of `shadowRootReferenceTargetMap` is based on the [`exportparts`](https://drafts.csswg.org/css-shadow-parts/#exportparts-attr) attribute that contains a comma-separated map of part names.

```html
<input role="combobox" type="text" aria-controls="animals" aria-activedescendant="animals">
<animals-listbox id="animals">
  <template shadowRootMode="open"
            shadowRootReferenceTargetMap="aria-controls: listbox,
                                          aria-activedescendant: opt1">
    <div role="listbox" id="listbox">
      <div role="option" id="opt1">Otter</div>
      <div role="option" id="opt2">Opossum</div>
      <div role="option" id="opt3">Ocelot</div>
    </div>
  </template>
</animals-listbox>
```

The JavaScript API reflects the mappings using camelCase names for the properties, and `htmlFor` for `for`:

```js
this.shadowRoot_.referenceTargetMap.ariaControls = "real-listbox";
this.shadowRoot_.referenceTargetMap.ariaActiveDescendant = "option-1";
this.shadowRoot_.referenceTargetMap.htmlFor = "real-input";
```

##### Combining `referenceTarget` and `referenceTargetMap`

In the case where both attributes are specified, `referenceTargetMap` takes priority for individual attributes, and `referenceTarget` acts as the fallback for attributes that are not specified.

In the example below, `"real-listbox"` is the target for all attributes _except_ `aria-activedescendant`, which is targeted to `"option-2"`.

```html
<input
  role="combobox"
  aria-controls="fancy-listbox"
  aria-activedescendant="fancy-listbox"
/>
<fancy-listbox id="fancy-listbox">
  <template
    shadowrootmode="open"
    shadowrootreferencetarget="real-listbox"
    shadowrootreferencetargetmap="aria-activedescendant: option-2"
  >
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>
```

##### Delegating to multiple elements

Some attributes such as `aria-labelledby`, `aria-describedby`, etc. support multiple targets. Using `referenceTargetMap` with those attributes support a space-separated list of IDs.

This example shows a `<description-with-tooltip>` component that contains a "More Info" button to show the tooltip but is not intended to be included in the description text. It targets `aria-describedby: message tooltip` to forward to only the content that should be included in the description text.

```html
<input aria-describedby="description-with-tooltip" />
<!--
  The resulting description text is: 
  "Inline description text. Tooltip with more information."
-->
<description-with-tooltip id="description-with-tooltip">
  <template
    shadowrootmode="closed"
    shadowrootreferencetargetmap="aria-describedby: message tooltip"
  >
    <div>
      <span id="message">Inline description text.</span>
      <button onmouseover="showTooltip()" onmouseout="hideTooltip()">More Info</button>
      <div id="tooltip" role="tooltip" style="display: none">Tooltip with more information.</div>
    </div>
  </template>
</description-with-tooltip>
```

#### Live references

As with `referenceTarget`, `referenceTargetMap` reference are "live".

In the example above, if the `aria-activedescendant` mapping is changed, then the `aria-activedescendant` of `<input>` will be changed to refer to the newly-mapped element.

- **Before**: `<input aria-activedescendant="fancy-listbox">` initially maps to 'option-1'.
- fancy-listbox internally updates its mapping:
  ```js
  this.shadowRoot_.referenceTargetMap.ariaActiveDescendant = "option-2";
  ```
- **After**: `<input aria-activedescendant="fancy-listbox">` now maps to 'option-2', without needing to update the input element itself.

##### Nesting inside `<label>`

If the shadow tree is using `referenceTargetMap`, implicit label association uses the `for` attribute from the map.

In the following example, the label of the `<input id="real-input">` is "Fancy input".

```html
<script>
  customElements.define(
    "fancy-input",
    class FancyInput extends HTMLElement {
      constructor() {
        super();
        this.shadowRoot_ = this.attachShadow({ 
          mode: "closed",
          referenceTargetMap: { htmlFor: "real-input" },
        });
        this.shadowRoot_.innerHTML = `<input id="real-input" />`;
      }
    }
  );
</script>

<label>
  Fancy input
  <fancy-input></fancy-input>
</label>
```

## Privacy and Security Considerations

No considerable privacy or security concerns are expected, but community feedback is welcome.

## Considered Alternatives

This section covers some design alternatives, along with discussion of their Pros and Cons, and why they were not included in the design.

### Alternative names for the feature "Reference Target"

The name "reference target" (`shadowrootreferencetarget`) follows the naming convention of other newer attributes used for IDREFs, such as `popovertarget` or `invoketarget`. Some possible alternative names:

- "Reference Delegate" - `shadowrootreferencedelegate="id"` - original name for this proposal
- "Delegates References" - `shadowrootdelegatesreferences="id"` - more similar wording to `shadowrootdelegatesfocus`.
- "Reflects References" - `shadowrootreflectsreferences="id"` - borrowing from the [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) proposal.
- "Forwards References" - `shadowrootforwardsreferences="id"` - borrowing from ["forwardRef" in React](https://react.dev/reference/react/forwardRef).

Ultimately, the name "reference target" is the most concise and consistent, and conveys the intent of the feature. However, community feedback is welcome on the name.

### Add `referenceTargetElement` attribute that targets an element object

The current API of `referenceTarget` is a string only, and targets the element by ID. An alternative would be to include an attribute like `referenceTargetElement`, which allows specifying element objects (without an ID).

```js
const input = document.createElement("input");
this.shadowRoot_.appendChild(input);
this.shadowRoot_.referenceTargetElement = input;
```

#### Pros

- Makes the API more flexible by not requiring an ID to be added to the target element.

#### Cons

- It does not unlock any net-new functionality. Since `referenceTarget` only works with elements inside the shadow root, every element that could be a target is accessible by a string ID reference.
  > Note: This is in contrast to the ARIAMixin attributes like `ariaLabelledByElements`, which _do_ unlock the new functionality of referring out of the shadow DOM. In that case, the complexity is necessary to include in the ARIAMixin design.
- At a basic level, Reference Target is augmenting the existing functionality of referring to elements by ID string. It seems in line with the design to require using ID strings.
- It requires adding support for [attribute sprouting](https://wicg.github.io/aom/aria-reflection-explainer.html#sprouting-relationship-attributes) to sync the `shadowrootreferencetarget` attribute with `referenceTargetElement`. This adds complexity to the spec.

### Use separate attributes for each forwarded attribute

An alternative to a single attribute `shadowrootreferencetargetmap` / `ShadowRoot.referenceTargetMap` would be to have individual attributes for each forwarded attribute:

- `shadowrootariaactivedescendanttarget`
- `shadowrootariacontrolstarget`
- `shadowrootariadescribedbytarget`
- `shadowrootariadetailstarget`
- `shadowrootariaerrormessagetarget`
- `shadowrootariaflowtotarget`
- `shadowrootarialabelledbytarget`
- `shadowrootariaownstarget`
- `shadowrootfortarget`
- `shadowrootformtarget`
- `shadowrootlisttarget`
- `shadowrootpopovertargettarget`
- `shadowrootinvoketargettarget`
- `shadowrootinteresttargettarget`
- `shadowrootheaderstarget`
- `shadowrootitemreftarget`
- `shadowrootreferencetarget` -- all other references except the ones specified above

Reflected by JavaScript attributes `ShadowRoot.ariaActiveDescendantTarget`, etc.

#### Pros

- Syntax is more in line with other HTML attributes, rather than using a comma-separated list of colon-separated map entries.
- Works with IDs that contain commas.
- It is possible to scope support for properties where this behavior has a real use-case, such as `aria-activedescendant`. This would limit the number of new properties to only a handful.

#### Cons

- Adds 15+ new attributes instead of 2.
- Less clear(?) that `shadowrootreferencetarget` only forwards references that are not explicitly specified by other elements.

### Designate target elements using attributes instead of IDREF

The [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md#usage-with-declarative-shadow-dom) explainer proposes adding attributes to elements inside the shadow tree:

```html
<x-foo id="foo">
  <template shadowroot="open" shadowrootreflectscontrols shadowrootreflectsariaactivedescendent>
    <ul reflectariacontrols>
      <li>Item 1</li>
      <li reflectariaactivedescendent>Item 2</li>
      <li>Item 3</li>
    </ul>
  </template>
</x-foo>
```

#### Pros

- Does not require an ID on the target element. [But does still require an extra attribute; possibly in addition to an ID if that ID is used for other purposes.]

#### Cons

- Requires new attributes in two places in order to work: E.g. `shadowrootreflectscontrols` on the shadow root _and_ `reflectariacontrols` on the target element.
- When multiple elements are used for the same attribute, the author cannot control the order (the order is always the DOM order).

### Use exported IDs instead of per-attribute targeting

The [ExportID explainer](https://github.com/WICG/aom/blob/gh-pages/exportid-explainer.md) proposes a way to refer to elements inside the shadow DOM by name. For example, `"fancy-input::id(real-input)"` to refer to a specific `<input>` element inside a `<fancy-input>`.

It would be possible to use exported IDs instead of `referenceTargetMap` if/when it is necessary to refer to an element other than the primary reference target.

#### Pros

- Does not suffer from the [bottleneck effect](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#limitations-of-these-apis).
- Potentially less confusing why you reference the _container_ listbox with `aria-activedescendant` instead of the element itself.

#### Cons

- Exposes some of the internal details of a control and does not give a way for the control to encapsulate those details.
  - This may not be a dealbreaker: the [`::part()`](https://drafts.csswg.org/css-shadow-parts/#part) CSS selector also has a similar drawback for CSS styles, but it still is a standard and a useful feature for styles.
- Incompatible with ARIAMixin attributes, which don't allow directly referencing elements inside other shadow trees.
  - It may be possible to work around this limitation, but it would require a change to the behavior of the ARIAMixin attributes, as well as new JavaScript APIs to resolve an IDREF like `"fancy-input::id(real-input)"` into an "ElementHandle" type object that references the element without giving full access to it (which would break shadow DOM encapsulation).

### Omit the "catch-all" `referenceTarget` attribute

It is technically possible to require all attributes to be individually targeted via `referenceTargetMap`, rather than also allowing `referenceTarget` as a "catch-all" for every attribute.

#### Pros

- The main argument to omit `referenceTarget` is that the semantics could change if more targeted attributes are added in the future. This could break existing websites by changing the target of an attribute, if it is added to `referenceTarget` support in the future.
- It makes it more difficult for browser vendors to incrementally implement reference target, since adding support for additional attributes is a breaking change.

#### Cons

- The Reference Target feature is intended to support all attributes that use ID references. Thus, the only time a new attribute will be supported by Reference Target is when it is a completely new attribute in the HTML spec. There is no backwards compatibility concern, since no websites will be using the new attribute before is is supported.
- It is beneficial that this feature automatically supports future attributes added to the HTML spec. It will not require any developer work to update to support new features.
- Including an easy-to-use catch-all attribute supports the HTML design principle of [Priority of Constituencies](https://www.w3.org/TR/html-design-principles/#priority-of-constituencies). It priorities users of the feature, over browser implementors and theoretical concerns.

## Appendix A: Combobox Example

This "kitchen sink" example implements a `<fancy-combobox>` using two components: `<fancy-input>` and `<fancy-listbox>`. It demonstrates:

- Delegating references through multiple layers of shadow DOM.
  - A label in the light DOM refers to the `<input>` inside the `<fancy-input>`, which is itself inside the `<fancy-combobox>`.
- Referring to an element in a sibling shadow tree.
  - Uses `ariaActiveDescendantElement` in `<fancy-input>` along with `referenceTargetMap` in `<fancy-listbox>` to connect the `<input>` with a `<div role="option">`.
- Using a custom prop to control the target of `referenceTargetMap`.
  - `<fancy-listbox>` allows the target of its `aria-activedescendant` to be controlled externally via its custom `activeitem` attribute.

#### `<fancy-input>`

This component is a wrapper around an `<input>`, similar to the one in the examples above with a few additional features.

1. It sets the input as the reference target. This lets, for example, a label for this component to be applied to the input.
2. A custom attribute `listbox` is hooked up to both `ariaControlsElements` and `ariaActiveDescendantElement`.
   - The listbox targets the two attributes to different elements inside (see `<fancy-listbox>` below), but this component references the parent listbox for both.
3. It observes the `role` attribute to set the `role` of the internal input.

```js
customElements.define(
  "fancy-input",
  class FancyInput extends HTMLElement {
    static observedAttributes = ["role", "listbox"];

    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({
        mode: "closed",
        referenceTarget: "real-input",
      });
      this.shadowRoot_.innerHTML = `<input id="real-input">`;
      this.input_ = this.shadowRoot_.getElementById("real-input");
    }

    attributeChangedCallback(attr, _oldValue, value) {
      if (attr === "listbox") {
        // (2)
        // Note: A real implementation will need to use connectedCallback and
        // MutationObserver to correctly set the listbox. This is just an
        // example of how ariaControlsElements might be updated.
        const listbox = value ? this.getRootNode().getElementById(value) : null;
        this.input_.ariaControlsElements = listbox ? [listbox] : null;
        this.input_.ariaActiveDescendantElement = listbox;
      } else if (attr === "role" && value !== "none") {
        // (3)
        this.input_.role = value;
        this.role = "none"; // Remove the role from the host
      }
    }
  }
);
```

#### `<fancy-listbox>`

This component is a wrapper around `<div role="listbox">` and the `<div role="option">` items inside.

1. It sets `<div role="listbox">` as the reference target for all references _except_ `aria-activedescendant`.
2. It has a custom attribute `activeitem`, which is used to control which item gets the `aria-activedescendant` delegation using `referenceTargetMap`. This lets the parent component control the active item.

```js
customElements.define("fancy-listbox",
  class FancyListbox extends HTMLElement {
    static observedAttributes = ["activeitem"];

    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({
        mode: "closed",
        referenceTarget: "real-listbox", // (1)
      });
      this.shadowRoot_.innerHTML = `
        <div id="real-listbox" role="listbox">
          <div id="option-1" role="option">Option 1</div>
          <div id="option-2" role="option">Option 2</div>
        </div>
      `;
    }

    attributeChangedCallback(attr, _oldValue, value) {
      if (attr === "activeitem") {
        this.shadowRoot_.referenceTargetMap.ariaActiveDescendant = value; // (2)
      }
    }
  });
</script>
```

#### `<fancy-combobox>`

This component combines the two components above into a combobox.

1. It hooks up the listbox to the input using the `<fancy-input>`'s custom `listbox` attribute.
2. It controls which item inside the listbox is the `aria-activedescendant` of the input using the `<fancy-listbox>`'s custom `activeitem` attribute.
3. It forwards all references to the `"combo-input"` component inside, which itself forwards references to the `"real-input"` inside.
4. Using a label's `for` attribute with the fancy-combobox pierces two layers of shadow DOM to apply the label to the `<input id="real-input">`.

```html
<label for="combobox">Combobox</label>
<fancy-combobox id="combobox">
  <template
    shadowrootmode="closed"
    shadowrootreferencetarget="combo-input"
  >
    <!-- (3) -->
    <div>
      <!-- (1) -->
      <fancy-input id="combo-input" role="combobox" listbox="combo-listbox"></fancy-input>

      <!-- (2) -->
      <fancy-listbox id="combo-listbox" activeitem="option-1"></fancy-listbox>
    </div>
  </template>
</fancy-combobox>
```
