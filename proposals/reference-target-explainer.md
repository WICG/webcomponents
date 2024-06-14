# Reference Target for Cross-Root ARIA

Author: [Ben Howell](https://github.com/behowell)

## Introduction

Reference Target is a feature to enable using IDREF attributes such as `for` and `aria-labelledby` to refer to elements inside a component's shadow DOM, while maintaining encapsulation of the internal details of the shadow DOM. The main goal of this feature is to enable ARIA to work across shadow root boundaries.

This proposal is based on [@Westbrook](https://github.com/Westbrook)'s [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) proposal, as well as borrowing ideas from [@alice](https://github.com/alice)'s [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) proposal.

## Background

### Cross-Root ARIA

For an in-depth description the cross-root ARIA problem, see [@alice](https://github.com/alice)'s article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). The article describes the two main problems that need to be solved: 

#### 1. Referring from Shadow DOM outwards

The existing [ARIAMixin IDL attributes](https://w3c.github.io/aria/#ARIAMixin) (such as `ariaLabelledbyElements` and `ariaActiveDescendantElement`) unlock part of the solution to the cross-root ARIA problem. They allow for an element inside a shadow DOM to create an ARIA link to an element outside that shadow DOM. However, they are limited in that they can't reference an element inside another component's shadow DOM. The specifics of this limitation are described in more detail in _How Shadow DOM and accessibility are in conflict_.

#### 2. Referring into Shadow DOM

The "missing piece" to solving the cross-root ARIA problem is the ability to refer into Shadow DOM. The Reference Target feature described in this explainer intends to solve this problem in a way that is compatible with the ARIAMixin attributes.

When Reference Target is used in conjunction with ARIAMixin, it is possible to create references between elements in sibling shadow DOMs, or between any two unrelated shadow DOMs on the page, as long as the components have provided the API to do so, through reference targets and custom attributes.

### Web components as drop-in replacements for builtin elements

Web components have an increasing number of features that allow them to work and act like builtin elements. For example:

- [Form-Associated Custom Elements](https://html.spec.whatwg.org/dev/custom-elements.html#form-associated-custom-element) can participate in forms like a builtin input.
- [delegatesFocus](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus) allows a component to work better with keyboard navigation.

However, there are still missing pieces that prevent a web component from truly being a drop-in replacement for a built-in, including:

1. Can't create ID reference links to elements inside a [shadow tree](https://dom.spec.whatwg.org/#shadow-trees).
2. Can't use built-in attributes like `aria-label` or `role` on the host and have them apply to an element inside the shadow root.
3. Non-trivial amount of code required to hook up custom attributes on the host to ARIAMixin attributes on an element inside the shadow root.
4. Can't get form-association for "free" by delegating to an input inside.

This proposal solves only the first problem: referring into the shadow DOM. It leaves the other problems to be solved by other features. While all of the problems may seem related, they can be designed separately.

## Proposal: Reference Target

Reference Target is a new feature that enables creating ARIA links to elements inside a component's shadow DOM, while maintaining encapsulation of the internal details of the shadow DOM.

#### Goals

- Solve only the "missing piece" of cross-root ARIA: how to handle IDREF attributes referring into the shadow DOM. Avoid scope creep.
- Create a mechanism for ID reference attributes like `aria-activedescendant` and `for` to refer to an element inside a component's shadow DOM.
- Should work the same for both closed and open shadow roots.
- Shadow DOM encapsulation should be preserved: No direct access to any elements inside the shadow tree, and no implementation details leaked into a web component's API.
- Should allow creating references into multiple nested shadow roots, and across "sibling" shadow roots that don't have a direct parent/child relationship.
- The solution should be serializable, i.e. support declarative syntax that is expressible in HTML without needing JavaScript.

#### Non-Goals

- This is scoped to only solve the problem of referring _into_ the shadow DOM. It relies on ARIAMixin to refer _out_ of the shadow DOM.
- This feature does not solve the [bottleneck effect](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#limitations-of-these-apis). It is difficult to find a compelling real-world example where this is a problem.
- This does not affect how attributes set on the host element work. For example, this does not tackle the problem of forwarding `role` or `aria-label`, etc. from the host element to an element inside.

#### Phases

This proposal is broken into two phases:

- [Phase 1](#phase-1) adds the ability to designate a single element as the target for _all_ IDREF properties that refer to the host.
- [Phase 2](#phase-2) adds a way to re-target specific properties (like `aria-activedescendant`) to refer a separate element.

The goal of breaking it into phases is to get the simpler syntax and simpler use cases working first. The solutions to Phase 2 are more complex and may need more discussion before they are ready.

### <a id="phase-1"></a> Phase 1: ShadowRoot `referenceTarget` attribute

A component can specify an element in its shadow tree to act as its "reference target". When the host component is the target of a IDREF like a label's `for` attribute, the referenceTarget becomes the effective target of the label.

The shadow root specifies the ID of the target element inside the shadow DOM. This is done either in JavaScript with the `referenceTarget` attribute on the `ShadowRoot` object, or in HTML markup using the `shadowrootreferencetarget` attribute on the `<template>` element.

JavaScript example:

```html
<script>
  customElements.define(
    "fancy-input",
    class FancyInput extends HTMLElement {
      constructor() {
        super();
        this.shadowRoot_ = this.attachShadow({ mode: "closed" });
        this.shadowRoot_.innerHTML = `<input id="real-input">`;
        this.shadowRoot_.referenceTarget = "real-input";
      }
    }
  );
</script>

<label for="fancy-input">Fancy input</label>
<fancy-input id="fancy-input"></fancy-input>
```

Equivalent with declarative shadow DOM:

```html
<label for="fancy-input">Fancy input</label>
<fancy-input id="fancy-input">
  <template
    shadowrootmode="closed"
    shadowrootreferencetarget="real-input"
  >
    <input id="real-input">
  </template>
</fancy-input>
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
  - `invoketarget` (proposed in [Invokers Explainer](https://open-ui.org/components/invokers.explainer/))
  - `interesttarget` (proposed in [Invokers Explainer](https://open-ui.org/components/invokers.explainer/))
- Tables
  - `headers`

> _Please comment if there are any attributes missing from this list._

### <a id="phase-2"></a> Phase 2: ShadowRoot `referenceTargetMap` attribute

There are situations where it is necessary to target different reference types to different elements. For example, a listbox may want to target `aria-controls` to its root, and `aria-activedescendant` to one of the items inside the listbox.

The `ShadowRoot.referenceTargetMap` attribute allows for specifying target elements based on the attribute that is being used to reference the host.

The equivalent declarative attribute is `shadowrootreferencetargetmap`, which is a comma-separated list of attribute to ID mappings.

> Note: the syntax of `shadowrootreferencetargetmap` is based on the [`exportparts`](https://drafts.csswg.org/css-shadow-parts/#exportparts-attr) attribute that contains a comma-separated map of part names.

```html
<input
  role="combobox"
  aria-controls="fancy-listbox"
  aria-activedescendant="fancy-listbox"
/>
<fancy-listbox id="fancy-listbox">
  <template
    shadowrootmode="closed"
    shadowrootreferencetargetmap="aria-controls: real-listbox,
                                  aria-activedescendant: option-1"
  >
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>
```

The JavaScript API reflects the mappings using camelCase names for the properties, and `htmlFor` for `for`:

```js
this.shadowRoot_.referenceTargetMap.ariaControls = "real-listbox";
this.shadowRoot_.referenceTargetMap.ariaActiveDescendant = "option-1";
this.shadowRoot_.referenceTargetMap.htmlFor = "real-input";
```

#### Live references

Reference targets are a "live reference": if the host internally changes its reference target mapping, any element that references the host will use the updated mapping.

In the example above, if the `aria-activedescendant` mapping is changed, then the `aria-activedescendant` of `<input>` will be changed to refer to the newly-mapped element.

- **Before**: `<input aria-activedescendant="fancy-listbox">` initially maps to 'option-1'.
- fancy-listbox internally updates its mapping:
  ```js
  this.shadowRoot_.referenceTargetMap.ariaActiveDescendant = "option-2";
  ```
- **After**: `<input aria-activedescendant="fancy-listbox">` now maps to 'option-2', without needing to update the input element itself.

#### Combining `referenceTarget` and `referenceTargetMap`

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

#### Delegating to multiple elements

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

### Interaction with other features

#### Interaction with CSS Selectors

The referenceTarget does not affect CSS selectors in any way. An ID selector will target the host element that has the matching `id` attribute, and _not_ its referenceTarget.

#### Form-associated custom elements

A [form-associated custom element](https://html.spec.whatwg.org/dev/custom-elements.html#form-associated-custom-element) supports being the target of a label's `for` attribute. But if the element has a Reference Target for the `for` attribute, then the label applies to the target instead. There are no other changes to the behavior of a form-associated custom element.

#### Nesting inside `<label>`

Reference Target allows for labels to be implicitly associated with the target element when the host is nested inside a `<label>` element. The shadow tree's reference target will be associated with the label that contains the element. If the shadow tree is using `referenceTargetMap`, this uses the `for` attribute from the map.

In the following example, the label of the `<input id="real-input">` is "Fancy input".

```html
<script>
  customElements.define(
    "fancy-input",
    class FancyInput extends HTMLElement {
      constructor() {
        super();
        this.shadowRoot_ = this.attachShadow({ mode: "closed" });
        this.shadowRoot_.innerHTML = `<input id="real-input" />`;
        this.shadowRoot_.referenceTarget = "real-input";
        // Alternatively, set the referenceTargetMap with the `for` attribute:
        // this.shadowRoot_.referenceTargetMap.htmlFor = "real-input";
      }
    }
  );
</script>

<label>
  Fancy input
  <fancy-input></fancy-input>
</label>
```

#### Nesting inside `<form>`

Reference target does not change the behavior of the host element when it is nested inside a form. It does _not_ implicitly associate the target element with the form if it is not a form-associated custom element.

#### JavaScript attributes that reflect `Element` objects

Some JavaScript attributes reflect HTML attributes as Element objects rather than ID strings. These include:

- ARIAMixin attributes like `ariaActiveDescendantElement`
- `HTMLButtonElement.popoverTargetElement`
- `HTMLInputElement.form`
- `HTMLInputElement.labels`
- `HTMLLabelElement.control`
- _(This list is not exhaustive)_

These will _always_ refer to the **host** element that they're targeting, and _never_ the referenceTarget element directly. This behavior maintains the design that an [IDL attribute with type Element](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes:element) can only refer to an element that is a descendant of a [shadow-including ancestor](https://dom.spec.whatwg.org/#concept-shadow-including-ancestor) of the element hosting the attribute.

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
  // [<fancy-listbox id="fancy-listbox">]
</script>
```

#### Interaction with `HTMLInputElement.labels` and `ElementInternals.labels`

The [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) attribute returns list of the label elements targeting a certain input element. This API should continue to work if the input element is itself the target of a custom element. The labels will be in [shadow-including tree order](https://dom.spec.whatwg.org/#concept-shadow-including-tree-order).

Since custom elements inherit from `HTMLElement` and _not_ `HTMLInputElement`, they don't have a `labels` attribute. However, if the custom element is form-associated _and_ has a `referenceTarget`, then [`ElementInternals.labels`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/labels) will return an empty list `[]`, since all labels are forwarded to the reference target and not associated with the custom element itself.

```html
<script>
  customElements.define(
    "form-input",
    class FormInput extends HTMLElement {
      static formAssociated = true;
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.internals = this.attachInternals();
        this.shadowRoot.innerHTML = `
        <label id="inner" for="real-input">Inner</label>
        <input id="real-input" />
      `;
        this.shadowRoot.referenceTarget = "real-input";
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
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.innerHTML = `<input id="real-input">`;
      this.shadowRoot_.referenceTarget = "real-input"; // (1)
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
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.innerHTML = `
        <div id="real-listbox" role="listbox">
          <div id="option-1" role="option">Option 1</div>
          <div id="option-2" role="option">Option 2</div>
        </div>
      `;
      this.shadowRoot_.referenceTarget = "real-listbox"; // (1)
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
