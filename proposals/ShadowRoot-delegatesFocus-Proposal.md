# ```delegatesFocus``` Proposal

To fix focusability and focus navigation order issue ([W3C 25473](https://www.w3.org/Bugs/Public/show_bug.cgi?id=25473), [Chromium 380445](https://code.google.com/p/chromium/issues/detail?id=380445)), introduce ```delegatesFocus``` flag under shadow root, to address some shortcomings that
the default focus navigation behavior ([defined in the Shadow DOM spec](https://w3c.github.io/webcomponents/spec/shadow/#focus-navigation)) has.

- Fix tab navigation ordering issue when shadow host has ```tabindex``` attribute
- Changes focusing behavior when mouse click or `focus()` on shadow host or within its shadow root to make it easier to create complex component like ```<input type="date">```
- ```:focus``` on shadow host matches when inner element is focused.

## Proposal

`delegatesFocus` is a read-only boolean property on a shadow root, which indicates focus activity (tab navigation, mouse click, focus()) on its shadow host will be delegated to its shadow.  This attribute is set via ```ShadowRootInit``` dictionary when ```createShadowRoot``` is called.  This attribute is immutable during the lifetime of its associated shadow root.

```WebIDL
partial interface ShadowRoot {
  readonly boolean delegatesFocus;
}

partial dictionary ShadowRootInit {
  boolean delegatesFocus;
}
```

## Details

If a shadow host delegates focus (its shadow root was created with `delegatesFocus=true`), the following behavior is expected.

1. TAB navigation order<br>
If tabindex is 0 or positive and the containing shadow tree has any focusable element, forward tab navigation will skip the host and forwards the focus to the first focusable element.
For backward tab navigation, the host is skipped after its first focusable element.
In the case of ```tabindex="-1"```, the whole shadow tree is skipped for the tab navigation.

2. `focus()` method behavior<br>
Invoking focus() method on the host element will delegate the focus the first focusable element in its shadow tree. This applies recursively for nested shadow trees. If the shadow root doesn’t contain any focusable element, the host itself gets focus.

3. [`autofocus` attribute](https://html.spec.whatwg.org/multipage/forms.html#autofocusing-a-form-control:-the-autofocus-attribute)<br>
If autofocus attribute is specified, the focus is forwarded like focus() method when the page load finishes.

4. Response to mouse click<br>
If focusable area within the shadow tree is clicked, the element gets focus. If non-focusable area within the shadow tree is clicked, the focus moves to the first focusable element in its shadow tree, as if the host gets ```focus()```ed.

5. CSS `:focus` pseudo-class<br>
A selector like `#host:focus` matches when focus is in any of its descendant shadow tree.


## Use cases

- When a web author wants to create his/her own one with multiple focusable fields using combination of Shadow DOM and Custom Elements


## Demo

1. [```<date-input>``` component](https://takayoshikochi.github.io/tabindex-focus-navigation-explainer/demo/date-input.html)

You see ```<date-input>``` ```<input type=date>``` fields.  The former is built with web components (as a polyme element), the latter is native implementation.

## References
- Read the [full document](https://github.com/TakayoshiKochi/tabindex-focus-navigation-explainer/blob/master/README.md) for more complete documentation.
- Follow [crbug/496005](http://crbug.com/496005) for Blink implementation.
