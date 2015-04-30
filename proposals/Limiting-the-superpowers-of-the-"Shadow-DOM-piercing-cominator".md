###### Prepared by Travis Leithead and Arron Eicholz

*Note, this approach may be obsoleted by the removal of the `>>>` mega-weapon for selecting through Shadow DOM boundaries. Otherwise, we think the following concept is very important to a complete web components ecosystem.*

# Concept

Within a collection of style sheets for a single document, any style can be mapped to any element with selectors. Specificity and source-order help disambiguate which styles ultimately apply, but there is no way of "protecting" certain elements from being styled or restricting the application of specific properties or specific property values.
 
When many designers collaborate on a web site, they may work independently, and when their respective style sheets are brought together, they can conflict with each other causing unexpected styling 'bleed' due to overly generic or overly specific selectors. Authors may wish to describe a set of enforcements on property styling for target elements within a document.
 
In the case of composed web pages, such as when two documents are brought together via iframes or when element trees are added to a document in a Shadow DOM, the iframe or Shadow DOM establishes a style isolation boundary. Usage of iframes and Shadow DOM are great solutions to solve the above style conflict problems. Yet, configuring the amount of styling "bleed" (what and how much) may be an important consideration for the component author. Certain structural elements and/or specific stylistic properties may be important to "lock" and protect against unwanted tampering via the Shadow DOM piercing selector `>>>`. Conversely, for iframes which conventionally do not allow style 'bleed' from parent-to-child, selective style bleed-through may be desirable under controlled circumstances.

Within this framework style sheet authors may want to control what styles are applied (or not) to a given element. Styling control may want to be provided at two [or optionally three] granularity levels for either local style sheet rules (all the styles associated with a single document) or rules applied across a boundary (e.g., across a Shadow DOM or iframe boundary) or both. Style control granularity might include allowing 1) all/none properties at the element level, 2) a specific set of properties per element, and 3) [if desired] the specific property values for a given property.

# Proposal: The `allowed` property and `@control` 

This proposal modifies the behavior of the `>>>` Shadow DOM boundary combinator, so that it is subject to the rules of a new `allowed` property. The `allowed` property can be applied to either 'boundary' styling control for Shadow DOM (e.g., "pierce by default unless not allowed"). We also propose to extend the behavior of the `>>>` combinator to apply to iframe boundaries to _enable_ style 'bleed' in those scenarios (e.g., "don't pierce by default unless allowed"). Furthermore, the HTML `iframe[seamless]` attribute is simplified so that parent style sheet rules no longer need be replicated into the child's stylesheet collection by default (this would be accomplished as desired by the `>>>` combinator).
 
### Note about style sheet protection

This proposal assumes that components have final say over their host when it comes to what their host can chose to style on them (a corollary to how iframes need to have control over whether they are allowed to be framed or not for security). In order for the stylistic controls provided by this proposal to be effective, components must be able to be closed against scripting in such a way as to disallow access to the component's style sheets after initial construction (or the host would be able to alter or remove the stylistic control rules). For example, restrictions to the component must include access to the CSS OM's `styleSheets` list, and the ability to create/attach new inline style elements). Whether a component is open or closed to script, this proposal enables the boundary for CSS to be independently configured.
 
### Security note:

Using the `allowed` and `@control` rules to poke open cross-boundary styling for a document can result in potential security problems. For example, if the document is hosted in an iframe, and the document allows control of the display property, then the iframe might use this control to reveal content previously hidden by display: none.

## The `allowed` property

This proposal introduces a new CSS property: `allowed`. Allowed applies stylistic controls to the elements matched by the selector.

### Grammar, etc.

-|-
--------------|-------------------------------------------------------------------------
Value(s):     | `auto | [ [ all | none ] || <custom-ident>#] && [ local || boundary ] ]`
Initial:      | auto
Applies to:   | all elements
Inherited:    | no
Percentages:  | N/A
Media:        | visual
Computed value: | specified value

### Element-level stylistic controls:

```css
selector {
   allowed: all local;   /* This sets the default styleability of the elements(s) to styleable for local author definitions (the default) */
}
```
```css
selector {
   allowed: all boundary;   /* This sets the default styleability of the elements(s) to styleable for boundary combinators '>>>' (current default for shadow-DOM, non-default for iframe boundaries) */
}
```
```css
selector {
   allowed: none boundary;   /* This sets the default styleability of the elements(s) to not-styleable for any boundaries combinators '>>>' (non-default for shadow-DOM, default for iframe boundaries) */
}
```
```css
selector {
   allowed: none local boundary;   /* This sets the default styleability of the elements(s) to not-styleable for local author definitions as well as for boundary combinators. All properties are reset to their initial values */
}
```
```css
selector {
   allowed: auto;   /* This sets the default styleability of the elements(s) to their default: styleable for local author rules, and for boundaries: non-styleable for iframe, styleable for shadow-DOM boundaries) */
}
```

### Applying exceptions to the default element-level stylistic controls

The `@control` rule provides a syntax to define the individual properties and property values that should be exceptions to the defaults defined by the `allowed` property. Additionally, the `@control` rule can be applied without specifying a default (e.g., `all`/`none`) in the `allowed` property in which case the default styleability for the exceptions list falls back to auto.

```css
selector {
   allowed: all my-exceptions local;  /* default styleability is styleable for local rules, with the following exceptions defined in 'my-exceptions' */
}
@control my-exceptions {
    background none;  /* note, no colon (:) separator between property name and keyword (all/none) */
    color none;   /* the color property is not styleable (its value is forced to initial--no exceptions) */
    border none;   /* the border property is not styleable (its value reverts to initial--no exceptions) */
}
```
```css
selector {
   allowed: none my-exceptions boundary;  /* default styleability is non-styleable for boundary combinators, with the following exceptions defined in 'my-exceptions' */
}
@control my-exceptions {
    background all;  /* note, no colon (:) separator between property name and keyword (all/none) */
    color all;   /* the color property is styleable with any value--no exceptions */
    border all;   /* the border property is styleable with any value--no exceptions */
}
```

### Combining @control rule definitions

`@control` rules may be combined using a comma-separated list of identifier names.

```css
selector {
   allowed: color-exceptions, box-model-exceptions boundary; /* default styleability is styleable for shadow-DOM boundaries and not-styleable for iframe boundaries. Since all/none is not specified the default depends on how the component is being hosted */
}
@control color-exceptions {
    color all; /* in shadow-DOM hosting, this does nothing, since default is styleable; in iframe, this allows color to be styleable as an exception */
}
@control box-model-exceptions {
   display none; /* in shadow-DOM hosting, this prevents the display property from being applied when set in a style rule via '>>>' combinators; in iframe, this does nothing since styleable is non-styleable by default */
}
```

Both property exceptions (`color` and `display`) are merged from each `@control` rule. Conflicts are resolved based on the order in which the `@control` identifiers are listed (last one wins).

### Use of `@document` in `@control`

Scoping the applicability of an `@control` declaration may be useful if a style sheet is intended to be used only in a component for inclusion in a certain target domain. In this case use `@document` to scope the allowances within an `@allowed` declaration.

```css
selector {
   allowed: defs boundary none;
}
@control defs {
   @document domain-of-applicability.com {
      display none;
      background-color all;
      visibility none { hidden; }
   }
}
```

## WARNING: Beyond here be dragons...

**Issue: shorthand properties and properties with multiple optional values are not well-understood how to filter/limit their values**

### Property value stylistic exceptions

In addition to allowing a property to be styleable or not (`all` or `none` keywords), the property's values can be further limited. In the case that a value list is defined, the `all` or `none` keywords (if defined) specify the default styleability for values are not explicitly listed.

```css
selector {
   allowed: patriotic none boundary;
}
@control patriotic {
   color { red; white; blue; }  /* Only the values of red white and blue are allowed for the color property (other values will be rejected because the value default is not specified and so this falls back to the default for the 'patriotic' exception list which is none). */
   background-color none { red; white; blue; } /* Only the values of red white and blue are allowed for the background-color property (other values will be rejected because the value default is 'none').
}
```

Only the color and background-color properties are allowed to be styled for the elements matched by this selector from across a boundary (local restrictions are not applied).

```css
selector {
   allowed: black-and-white local;
}
@control black-and-white {
   color none { white; black; }  /* Only the values of white and black are allowed for the color property (other values will be rejected because the value default is 'none'). */
}
```

All properties are styleable by default (which is the default for `local`), with the exception of the color property which is limited to only the values of `black` and `white` -- no other values are accepted.

```css
selector {
   allowed: borders boundary none;
}
@control borders {
   border-radius all { greater-than(10px); }  /* Any value for border-radius except those that compute larger than 10px are allowed (other values will be rejected because the value default is 'none'). */
   color all { white; } /* Any value of color is allowed with the exception of 'white' */
}
```

### New keywords and functions for property value exceptions

##### Keywords (enumerated values)

* Use the value that the property would ordinarily expect, e.g., (red for color, block for display, etc.)
* Special keywords
  * #rgb
  * #rrggbb
  * rgb
  * rgba
  * hsl
  * hsla
  * percentage
  * length
  * calc
  * attr

##### Functions
  * range(min, max)
  * greater-than(value)
  * less-than(value)
  * equal(value)
  * not-equal(value)
  * rgba-range(30-45, auto, 100-255, auto)
  * hsla-range()

# Feedback on the Proposal

1. Whoah... what?
2. Why is this control language in CSS?
3. The `@control` syntax is weird
4. Value level restrictions seem cool, but may not be practical given the complexity