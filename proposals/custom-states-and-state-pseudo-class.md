# `ElementInternals.states` and the `:state()` pseudo class

Author: @rakina, @domenic

## Introduction

Built-in elements have certain “states” that can change over time depending on user interaction and other factors, and are exposed to web authors through pseudo classes. For example, some form controls have the “invalid” state, which is exposed through the `:invalid` pseudo class.

Like built-in elements, custom elements can have various states to be in too, and web authors might want to expose these states in a similar fashion as the built-in elements. With the proposed `states` property on `ElementInternals`, custom element authors can add and modify custom states for the custom elements, and allow them to be selected with the `:state()` selector.

### Goals

-   Give a way for custom element authors to expose varying states of the custom elements to custom element users
-   Allow styling of custom elements that differ according state
-   Allow styling of custom elements that differ according to state even when they are only accessible via shadow parts. That is, `element::part(x):state(y)` should work if `::part(x)` selects a custom element with state y.
    

### Non-goals

-   Allowing adding custom states to built-in elements. States reflect outward what the element implementation author wishes to show the world; for application-level state, use the `class=""` attribute or similar.
-   Allowing custom element authors to modify already-existing/built-in states/pseudo classes, e.g. `:checked`. (This might be added in the future, though.)

## Example

```html	
<!DOCTYPE html>

<!-- Basic usage: -->
<script>
class LabeledCheckbox extends  HTMLElement {
  constructor() {
    super();
    this._internals = this.attachInternals();
    this._checked = false;
    this.addEventListener('click', this._onClick.bind(this));

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.innerHTML =
      `<style>
        :host::before { content: '[]'; }
        :host(:state(checked))::before { content: '[x]' }
      </style>
      <span><slot>Label</slot></span>`;
  }
  
  get checked() { return this._checked; }
  
  set checked(flag) {
    this._checked = !!flag;
    if (this._checked) {
      this._internals.states.add("checked");
    } else {
      this._internals.states.remove("checked");
    }
  }

  _onClick(event) {
    this.checked = !this._checked;
  }
  
}

customElements.define('labeled-checkbox', LabeledCheckbox);
</script>

<style>
  labeled-checkbox { border: dashed red; }
  labeled-checkbox:state(checked) { border: solid; }
</style>

<labeled-checkbox>You need to check this</labeled-checkbox>

<!-- Works even on ::part()s -->
<script>
class QuestionBox extends HTMLElement {
  constructor() {
    super();
    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.innerHTML =
      `<div><slot>Question</slot></div>
      <labeled-checkbox part='checkbox'>Yes</labeled-checkbox>`;
  }
}
customElements.define('question-box', QuestionBox);
</script>

<style>
  question-box::part(checkbox) { color: red; }
  question-box::part(checkbox):state(checked) { color: green; }
</style>
  
<question-box>Continue?</question-box>
```
## Proposal 

```webidl
partial interface mixin ElementInternals {
  readonly attribute DOMTokenList states;
}
```

Add a `states` property to the [ElementInternals](https://html.spec.whatwg.org/multipage/custom-elements.html#elementinternals) interface to contain a list of states for the corresponding custom element, and a new `:state(x)` pseudo-class that can select custom elements that contains `x` in its `elementInternals.states`. An example implementation of a custom element that uses this is shown above.

## Alternatives considered

### Just use attributes or class names on the custom element
This is bad because the custom element user might use clashing attribute names, causing problems.
	 

### Exposing this on shadow host
    
 Since this is not really related to exposing things from within a shadow tree, it does not make much sense to add states to shadow hosts. [Initial discussions](https://github.com/w3c/webcomponents/issues/738) suggested such an API shape, but that was before we came up with the `ElementInternals` concept for manipulating state on custom elements.
    

### Allowing custom states to use the same syntax as built-in ones, e.g. `:foo` instead of `:state(foo)`
    
This causes compatibility issues if we ever want to introduce new CSS pseudo-classes in the future that could apply to the element.
    

### Different syntax choices for custom states, e.g. `:--foo`
    
We are open to other suggestions. However the discussion so far seems to favor `:state(foo)`.
