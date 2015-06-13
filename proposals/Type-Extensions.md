# Type Extensions

This document explores the pros and cons of various options for instantiating a custom element as an extension of a native element.

## Potential benefits of type extensions

### Access to native element behaviour

#### Accessibility

* Using a type extension means - in most cases - that you get the semantics of the extended element without doing any extra work. This is discussed in detail [in the spec](http://w3c.github.io/webcomponents/spec/custom/#semantics).

#### Forms behaviour
#### Script-supporting element behaviour

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

## Alternative proposals
