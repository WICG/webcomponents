# HTML Templates As Microtemplates With Expressions

## Background

The HTML Template element has proven many of its skeptics wrong, establishing itself as a powerful tool in modern web development and more than able to hold its own against template engines like [Pug] and [Mustache] in a more web-friendly manner. One of the few things that template elements lack is a way of handling simple logic like `if` or `foreach` expressions. This is entirely understandable: Mustache adopts the most conservative position possible by limiting itself to just those two expressions, and even then it immediately makes their inherent drawback obvious: they require dedicated syntax. A template engine has to decide on a semantic syntax it wants to use and must there-after adhere to it; no second guessing.

Most proposals for filling in the missing gaps with template elements envision standardizing a syntax similar to Mustache or some similar alternative. This proposal offers a different route: a standardized API for handling template element expressions with directives.

```html
<ul>
    <template directive="foreach" expression="item items" registry="pseudomustache">
        <li>{{item.text}}</li>
    </template>
</ul>
```

## API

> NOTE: This is written in TypeScript instead of IDL for the sake of simplicity.

```ts
type TemplateExpressionCallback = (node: Node, expression: string[]) => void;

interface TemplateExpressionCallbackObject {
    processDirectiveCallback(node: Node, expression: string[]): void;
}

type TemplateExpressionCallbackOrCallbackObject = TemplateExpressionCallback | TemplateExpressionCallbackObject;

class TemplateExpressionRegistry {
    has(directive: string): boolean;
    register(directive: string, TemplateExpressionCallbackOrCallbackObject): void;

    static create(...registries: TemplateExpressionRegistry[]): TemplateExpressionRegistry;
}

interface Document {
    defineTemplateExpressions(name: string, registry: TemplateExpressionRegistry): void;
}

interface HTMLTemplateElement {
    defineTemplateExpressions(name: string, registry: TemplateExpressionRegistry): void;
}
```

## Explanation

### Logic

When the user agent encounters a `<template>` element with the `directive` and `registry` attributes, if a template expression registry with the `registry` name was registered with `document.defineTemplateExpressions` and supports the `directive` directive, it will create a cloned node and call the directive with `expression` as an array of arguments. The only exception is if the `<template>` element is nested (i.e. inside another `<template>`), in which case it will be handled by the parent template.

### Security

If a `TemplateExpressionRegistry` tries to register a directive that has already been registered with the same name, an exception should be thrown. This is to prevent malicious actors from inserting code without the user's knowledge.

### `TemplateExpressionRegistry.create`

Some applications may wish to re-use directives from more than one registry by combining multiple registries into a single name. The static `TemplateExpressionRegistry.create` handles this by creating a new registry from an array of registries in reverse order of preference (i.e. if the first and last registries passed both have the `foreach` directive, the new registry will use the directive from the last registry).

## Future Work

- More clearly define behavior in nested template.

## Acknowledgements

This proposal was heavily inspired by parts of the [Template Instantiation] proposal but modified to remove any dependencies on a specific syntax.

[Template Instantiation]: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md
