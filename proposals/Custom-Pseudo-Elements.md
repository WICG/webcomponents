# Custom Pseudo-elements

**by Philip Walton**

## Motivation

The current, recommended method for exposing parts of a Web Component for styling by third-party users is to define [CSS custom properties](https://drafts.csswg.org/css-variables/) in the element's shadow root, so those properties can be defined by third-party users and the styles inherited by the custom element.

This is an effective method for many use-cases, but it has the significant limitation of not easily allowing conditional styling based on CSS pseudo-classes.

Perhaps the most common use-case for pseudo-class styling is custom elements that use `<input>` or `<button>` elements within their shadow root and want to expose various states for styling such as `:hover`, `:focus`, `:disabled`, `:invalid`, `:out-of-range`, etc.

Another common use-case is custom elements that host sets of common elements in their shadow roots and want to allow the use of conditional selection via pseudo-classes like `:first-child`, `:last-child`, `:nth-child()`, and `:nth-of-type()`.

With custom properties, the only way to handle these use cases is to anticipate and define custom properties for all possibilities and combinations of possibilities, which is tedious, verbose, and sometimes impossible. The limitation of the custom properties approach is it doesn't give users access to an element, and thus users can't use selectors to conditionally target that element.

This proposal offers a mechanism to allow component authors to expose some internal elements for external styling without exposing all internal elements. It gives flexibility to users without sacrificing predictability for authors.

## Proposal

A custom pseudo-element is a DOM element within a custom element's shadow root that the custom element author has explicitly declared to be styleable from outside of the shadow root via a [CSS pseudo-element selector](https://drafts.csswg.org/selectors-4/#pseudo-elements).

The pseudo-element name is defined using the `pseudo` attribute on one or more elements within the shadow root of a custom element. For example, the following custom `<date-range-selector>` element defines the custom pseudo-elements `::start-date` and `::end-date`:

```html
<date-range-selector>
  <!-- #shadow-root -->
    <div id="container">
      <input pseudo="start-date" id="start-date" type="date">
      <input pseudo="end-date" id="end-date" type="date">
    </div>
  <!-- /shadow-root -->
</date-range-selector>
```

This element could be styled from a main document stylesheet as follows. Notice that the pseudo-element name is the same as the name set on the `pseudo` attribute:

```css
date-range-selector::start-date,
date-range-selector::end-date {
  /* normal styles */
}

date-range-selector::start-date:focus,
date-range-selector::end-date:focus {
  /* focus styles */
}

date-range-selector::start-date:out-of-range,
date-range-selector::end-date:out-of-range {
  /* out-of-range styles */
}
```

The above example nicely illustrates the limitations of custom properties and the advantages of custom pseudo-elements. To achieve the same styling as shown above with custom properties alone, the element author would have to create property names for all the various pseudo-class states, e.g. `:hover`, `:focus`, `:active`, `:in-range`, `:out-of-range`, `:valid`, `:required`, etc., as well as all the possible combinations of those states, e.g. `:focus:required:valid`, `:disabled:hover`, etc., which are far too numerous to reasonably expect authors to do.

CSS already has selectors to allow users to conditionally style elements. To deny that feature to elements inside a shadow root would be unnecessarily limiting.

### Cascade rules

Styles defined outside of the custom element's shadow root (user styles) are always higher in the cascade order than styles defined inside the custom element's shadow root (author styles), with the exception of declarations marked `!important`, where author styles are higher in the cascade order than user styles. This is analogous to how user-agent stylesheets work today.

The order is as follows (higher trumps lower):

* Important author declarations
* Important user declarations
* Normal user declarations
* Normal author declarations

To offer a concrete example, a rule defined in the main document via the selector `date-range-selector::start-date` would override a rule defined in the `<date-range-selector>` element's shadow root with the selector `:host > #container #start-date`, even though the selector in the shadow root has a higher specificity.

### Selector combinators

Exposing an element in the shadow root via a pseudo-element selector does not expose its children (e.g. `x-foo::bar > div` would not match any elements, even if `x-foo::bar` has child `<div>` elements).

Combinators, however, can be used to target multiple custom pseudo-elements. For example, `x-foo::container:hover x-foo::item` is valid as long as both `x-foo::container` and `x-foo::item` are present.

## Open questions

The following questions are up for debate and require consensus:

#### Should custom pseudo-element selectors require the element prefix?

**Pros:** requiring the element prefix will prevent the accidental naming collision of custom pseudo-elements with the same name being accidentally styled via the same CSS rule. It will also give authors the freedom to pick generic names like "container", "button", or "title" and avoid vendor-prefix-like names such as `::-webkit-calendar-picker-indicator`.

**Cons:** this would be a deviation from the way pseudo-elements currently work and could cause confusion.

#### Should custom pseudo-element names require a prefix to differentiate them from standard pseudo-elements?

**Pros:** requiring a prefix will ensure there is never a conflict with new standard pseudo-elements, this is similar to the requirement of a hyphen in custom element names to avoid conflicts with future HTML elements.

**Cons:** increased verbosity.

#### Should pseudo-classes like `:matches()` and `:not()` be allowed in cases where it could expose implementation details?

For example, should the selector `super-list::item:matches('li')` be allowed to match, or is the fact that the pseudo-element happens to be a `<li>` element privileged information?
