# DOM Parts Declarative Template API

This proposal covers the declarative API for creating a DOM part within a
`<template>` element.

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

And the application has produce a template with the following content:

```html
<template>
  <section>
    <h1 id="name">{{}}</h1>
    Email: <a id="link" href="{{}}">{{}}</a>
  </section>
</template>
```

This will create a `ChildNodePart` attached to `<h1>` with no content, a
`NodePart` attached to `<a>`, and an `AttributePart` connected to `href`.

A framework could fetch these parts use either a
[`DocumentPart`](./DOM-Parts-Imperative.md#option-2-documentpartgroup) on the
`DocumentFragment` produced by the template.

## `PartialAttributePart`

Allowing `{{}}` inside an attribute with some static content raises the same
question as a
[`PartialAttributePart`](./DOM-Parts-Imperative.md#partial-attribute-updates),
but if the imperative questions are resolved so too could the declarative
template syntax.

## Metadata

Templating systems may need to serialize data about the nodes they are marking
into the processing instructions. Or at the very least parts could be named so
that they are easier to fetch.

```html
<div>{{email data="foo"}}</div>
```

This could be exposed on the imperative API to be consumed in JavaScript by
application logic.

## Choice of marker

The `{{}}` is a reasonable DOM part marker, but it could be something else, or
it could even be something that is declared as the placeholder.

## Compatability

It may be challenging to implement `<template>` parsing of `{{}}` for
compatability reasons, so there may need to be restrictions such as only
allowing this template syntax in a new API like `createTemplateWithParts()`.
