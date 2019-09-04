
# Default focus behaviors for custom elements

Author: @rakina, @domenic, @tkent-google

## Introduction

Built-in elements are treated in different ways depending on their tag, attribute, style, etc. in terms of focus. Some built-in elements need an explicit `tabindex` set to be focusable, some can be focused through calling `focus()`, some others can be focused with clicking or through the tab key focus navigation, etc. In some cases their focusability also depends on the user agent and the OS, where certain preferences can make certain types of built-in elements to be focusable/not focusable. For example in macOS, editable form controls are click-focusable while non-editable form controls are not click-focusable.

Meanwhile, all custom elements are treated the same for focus: they aren’t focusable by default, and they can only be made focusable by explicitly setting the `tabindex` attribute. This causes problems because the custom element user might also manipulate the `tabindex` attribute, causing a loss of default when the user changes the value and then removes it - leaving the custom element without any `tabindex` value.

### Goals
-   Give a way for custom elements to have the same range of focus behaviours as built-in elements.
    
### Non-goals
-   Give a way to change the default focus behavior for built-in elements.
-   Give a way for custom elements to have fully custom focus behavior that doesn’t follow a certain built-in element.
    

## Example

```html
<script>
class MyButton extends HTMLElement {
  constructor()  {
    super();
    this._internals =  this.attachInternals();
    this._internals.matchFocusBehaviorOf =  "input[type='button']";
  }
}
</script>
<!-- these two buttons would behave the same for focus -->
<input type="button" value="Click me">
<my-button>Click me</my-button>
```

## Proposal

Add a new property `matchFocusBehaviorOf` to `ElementInternals`, which accepts a string containing a tagname and optionally an attribute with a value (so it will accept values like `div`, `a[href]`, `input[type='checkbox']` , but not `.class`, `*`, etc.). The custom element will then be treated as if it has that tagname and attribute in terms of focus.

## Alternatives considered

### Using other ways to represent the built-in elements

The proposed API above uses a CSS selectors to represent the built-in elements, but we’ve also considered some variants:

 - Using “tagname + one attribute name + attribute’s value” combination,
   e.g. `elementInternals.matchFocusBehaviorOf = {"input", "type," "button"}`
   
 - Using a predefined list of items representing the built-in elements.
   The list would include all html tag names, `a[href]`,
   `input[type=X]`, etc.
   
-  Using an element instance to follow, e.g. `elementInternals.matchFocusBehaviorOf = buttonElement;`

All of the alternative API shapes below can be considered to replace the currently proposed API.

### Follow focus behavior from an enumerated list of high-level concepts (e.g. `"text entry", "clickable", etc)

Instead of following a certain tagname, we would instead follow a certain “high level” concept that covers all the built-in elements, so the enum list would be like like “option”, “button”, “text entry”, etc.

Although this approach would be more descriptive, it might get out of date when a new way of focusing is added to the platform or other conventions change.

### Allow setting default tabindex values

One simple way to allow default focusability is to just add an `ElementInternals` version of `tabindex` so that even after being overridden by the custom element user, the default value can still be restored later.

However, this means the custom element can’t exactly emulate the behavior of built-in elements that are skipped/not focusable in certain conditions depending on preferences, etc. For example, if someone wants to make a new awesome-checkbox element, they would probably want to follow the behavior of `<input type="checkbox>` to be consistent---even though that behavior varies across platforms.

Additionally, `tabindex` is not powerful enough to emulate the built-in focus behaviors entirely. The possible behaviors are not focusable (omitted), programmatically-focusable/click-focusable/not sequentially-focusable (-1), and programmatically-focusable/click-focusable/sequentially-focusable (>=0). Such a `tabindex`-based API does not allow combinations such as programmatically-focusable/not click-focusable/not sequentially-focusable, like macOS Safari checkboxes, or programmatically-focusable/not click-focusable/sequentially-focusable, like macOS Safari checkboxes with the `Option` key held down.
