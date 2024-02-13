# DOM Parts Declarative API

This proposal covers the declarative API for creating a DOM part within a
`<template>` element and main document HTML.

## Proposal

Double curly braces `{{}}` provide markers for DOM parts.

In the most basic level, this proposal can produce the three DOM parts:
`NodePart`, `AttributePart`, `ChildNodePart`.

### Basic Examples

Suppose we had the following template in some HTML extension template languages
where `{name}` and `{email}` indicated locations of dynamic data insertion:

```html
<section>
  <h1 id="name">{name}</h1>
  Email: <a id="link" href="mailto:{email}">{email}</a>
</section>
```

And the application has produced an HTML `<template>` with the following
content:

```html
<template>
  <section>
    <h1 id="name">{{}}</h1>
    Email: <a id="link" href="{{}}">{{}}</a>
  </section>
</template>
```

This will create a `ChildNodePart` attached to `<h1>` with no content, an
`AttributePart` connected to `href`, and a `ChildNodePart` connected to `<a>`
with no content.

A framework could fetch these parts using the `getPartRoot()` on the
[`DocumentFragment`](./DOM-Parts-Imperative.md#retrieving-a-documentpartroot)
and then calling [`getParts()`](./DOM-Parts-Imperative.md#getparts).

## Enablement

For any DOM node, including `<template>`, a new `parseparts` attribute is
introduced that indicates to the parser it should parse DOM part tags as DOM
parts.

```html
<div parseparts></div>
```

Even for `innerHTML` use cases, only DOM nodes that are wrapped DOM with the
`parseparts` attribute will use declarative parts.

## Node parts

For node parts, a `{{}}` tag could be provided as an attribute.

```html
<template>
  <section {{}}></section>
</template>
```

Would create a `NodePart` for `<section>`.

## Partial attributes

Allowing `{{}}` inside an attribute works the same as a
[partial attribute update](./DOM-Parts-Imperative.md#partial-attribute-updates),
in that it will create an `AttributePart` for the entire attribute, but it will
have multi-valued `value` property.

```html
<template>
  <section>
    <h1 id="name">{{}}</h1>
    Email: <a id="link" href="mailto:{{}}">{{}}</a>
  </section>
</template>
```

The `AttributePart` for `href` would have `statics` equal to `['mailto:', '']`.
Empty string values are provided for any markers without default content.

## Default Values

To provide default values for any part, a part can be split into a start `{{#}}`
and finish `{{/}}` indicators.

```html
<template>
  <section>
    <h1 id="name">{{#}}Ryosuke Niwa{{/}}</h1>
    Email:
    <a id="link" href="mailto:{{#}}rniwa@apple.com{{/}}">
      {{#}}rniwa@apple.com{{/}}
    </a>
  </section>
</template>
```

## Names and Metadata

Templating systems may need to serialize data about the nodes they are marking
into the processing instructions. Or at the very least parts could be named so
that they are easier to fetch.

```html
<div>{{email data="foo"}}</div>
```

This could be exposed on the imperative API to be consumed in JavaScript by
application logic.

For parts that are split between opening and closing, it's possible to have
multiple metadata values which are included as two elements in the `metadata`
field.

```
{{# metadata1}}default value{{/ metadata2}}
```

## Choice of marker

The `{{}}` and `{{#}}{{/}}` are reasonable DOM part markers, but this is open to
proposals. It's possible to even allow the page to decide ewhat their markers
should be.
