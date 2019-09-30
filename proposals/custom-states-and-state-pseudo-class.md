# `ElementInternals`'s `states` property and the `:state()` pseudo class

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

## Security and Privacy Considerations

This feature must not have security and privacy implications.  The feature works within a single document, and nothing is exposed to outside of the document.

## Major open issues

-   Web components should be able to expose a list of supported states to web components users.

## Discussions

-   https://github.com/w3c/webcomponents/issues/738
-   [TPAC 2019](https://www.w3.org/2019/09/17-components-minutes.html#item01)

## Self-Review Questionnare on Security and Privacy

This section is for TAG Review.

### 2.1. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

Nothing new is exposed from users.  This feature works within a single document.

The feature exposes some information from web components implementations to web components users.

### 2.2. Is this specification exposing the minimum amount of information necessary to power the feature?

Yes.  This feature exposes only what web components author intend to expose.

### 2.3. How does this specification deal with personal information or personally-identifiable information or information derived thereof?

The feautre doesn't handle any kind of PII directly.
A web component implementation might handle PII, and might expose it via this feature. However, it's responsibility of web component author.

### 2.4. How does this specification deal with sensitive information?

Ditto.

### 2.5. Does this specification introduce new state for an origin that persists across browsing sessions?

No.

### 2.6. What information from the underlying platform, e.g. configuration data, is exposed by this specification to an origin?

None is exposed with this feature.

### 2.7. Does this specification allow an origin access to sensors on a user’s device

No.

### 2.8. What data does this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

None is exposed with this feature.

### 2.9. Does this specification enable new script execution/loading mechanisms?

No.

### 2.10. Does this specification allow an origin to access other devices?

No.

### 2.11. Does this specification allow an origin some measure of control over a user agent’s native UI?

No.

### 2.12. What temporary identifiers might this this specification create or expose to the web?

None.

### 2.13. How does this specification distinguish between behavior in first-party and third-party contexts?

No differences.  This feature should work regardless of first-party or third-party contexts.

### 2.14. How does this specification work in the context of a user agent’s Private Browsing or "incognito" mode?

No differences.  This features should work in such mode, and sites can't detect such mode with this feature.

### 2.15. Does this specification have a "Security Considerations" and "Privacy Considerations" section?

Yes.

### 2.16. Does this specification allow downgrading default security characteristics?

No.

### 2.17. What should this questionnaire have asked?

N/A.
