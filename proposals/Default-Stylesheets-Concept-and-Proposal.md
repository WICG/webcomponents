###### Prepared by Travis Leithead and Arron Eicholz

# Concept

While Shadow DOM offers web developers the affordance of a style isolation boundary, it is not always the case that a component desires pure isolation. In many cases, component authors (or more generally any web development team working together on a single composed web application) may want to associate a default style with a component without worrying that the specificity and/or ordering of the selectors might cause a conflict with other author styles intended to affect the same component.
 
At Microsoft, our WinJS framework team ran into the above problem a lot: styles intended to be a baseline/ default style would inadvertently take precedence over other author styles due to how CSS calculates specificity within an author style sheet.

To address these problems, authors should be able to indicate that a group of selectors shall be designated as "default" styles, to be processed at an earlier level in the cascade (i.e., applied before other author styles). Default styles allow authors to specify a set of styles that behave as if they were built-in or provided by the user agent itself.

As with all proposals this is one possible implementation of the concept:

# Proposal

The @default rule

## Example:

```html
<body>
  <pre id="color">Text Color</pre>
</body>
```

```css
@default {
   pre#color { color: red; }
}
pre { color: green; }
```

The `Text Color` is green. The author style (a less-specific selector) overrides the default style (a more specific selector) because it is evaluated earlier in the CSS cascade. Remove the author style (or set its color to ‘default’ to get back to the red default.

## Origin and Importance
###### A supplement to the section in CSS Cascading and Inheritance

The origin of a declaration is based on where it comes from and its importance is whether or not it is declared !important (see below). The precedence of the various origins is, in descending order:

1. Transition declarations
2. Important user agent declarations
3. **Important default declarations** `<-- Added`
4. Important user declarations
5. Important override declarations
6. Important author declarations
7. Animation declarations
8. Normal override declarations
9. Normal author declarations
10. Normal user declarations
11. **Normal default declarations** `<-- Added`
12. Normal user agent declarations

Declarations from origins earlier in this list win over declarations from later origins.

## Default values

Each property has a default value, defined by the default style sheet. If no default style sheet is defined then the values are the same as the user agent style sheet.

# Feedback on the Proposal

1. Why use another at-rule? Should the mechanism be done outside of CSS (e.g., a new `link[rel]` method)?

  * I think it may be useful for default styles to be nestable within other at-rules (and vice-versa), such as @document, @media, etc., which isn’t possible if defined out of CSS itself.
  * !unimportant was my initial idea that sprang to mind, but it might become tedious to add that annotation to a large set of styles...

2. What does !important do in a default style declaration?

  * Like in author style sheets, the !important rules promotes those declarations into another layer. This has 
the someone odd effect of making the default !important rules more important than a normal !important declaration! This is just how it fell out in the cascade order by natural reflection of the cascade. We could probably change this if necessary.
