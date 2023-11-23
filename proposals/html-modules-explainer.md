# HTML Modules Explainer

Author: [@dandclark](https://github.com/dandclark)

## Introduction

We are proposing an extension of the ES Modules system to include HTML Modules.  These will allow web developers to package and access declarative content from script in a way that allows for good componentization and reusability, and integrates well into the existing ES Modules infrastructure.

## Why are HTML Modules needed?

The introduction of ES Script Modules has provided several benefits for JavaScript developers including more componentized code and better dependency management.  However, easy access to declarative content has been a consistent limitation with Script Modules.  For example, if one wants to pack a custom element definition in a module, how should the HTML for the element's shadow tree be created?  Current solutions would involve generating it dynamically (document.createElement,  innerHTML or by using template literals), but it would be preferable from both a developer convenience and from a performance standpoint to simply write HTML and include it with the module.  With HTML Modules this will be possible.

There is clear demand for this functionality in the developer community -- see [this thread](https://github.com/w3c/webcomponents/issues/645) where ideas pertaining to HTML Modules have resulted in a great deal of developer and browser implementer engagement.

[HTML Imports](https://www.w3.org/TR/html-imports/) were proposed (and implemented in Chromium) as a solution, but they were developed independently of ES Modules and have several limitations:

* **Global object pollution:** vars created in an HTML Import show up on the global object by default.  An ideal solution would minimize such side-effects.  Accordingly, global object pollution does not occur in ES Modules.
* **Parse blocking with inline script:** the parsing of an HTML Import will block the main document's parser if included prior to an inline script element.  ES Modules have defer semantics and thus do not block the parser.
* **Independent dependency resolution infrastructures between HTML Imports and ES Script Modules:** since these systems were developed independently their infrastructures for dependency resolution don't talk to each other, leading to missed performance opportunities and to bugs like [this one](https://bugs.chromium.org/p/chromium/issues/detail?id=767841).
* **Non-intuitive import pass through:** HTML Imports require the consumer to access their content from standard DOM queries like getElementById and querySelector.  This is clumsy and limited relative to Script Modules' import/export statements that allow for explicit specification of the API surface provided by a module.

Integrating HTML Modules into the existing ES Module system, rather than creating it as a standalone component, will address these gaps.

## High-level summary

### Importing an HTML Module
HTML Modules will be imported using the [import attributes](https://github.com/tc39/proposal-import-attributes) syntax:

```html
<script type="module">
    import {content} from "foo.html" with {type: "html"};
    document.body.appendChild(content);
</script>
```

Each imported HTML Module will have its own [module record](https://tc39.github.io/ecma262/#sec-abstract-module-records) as introduced in the ES6 spec and will participate in the ES Module map and module dependency graphs.

An HTML Module will be parsed per the normal HTML5 parsing rules, with the exception that it is only allowed to contain `<script>` elements of `type="module"` (non-module scripts will cause HTML Module creation to fail).  This greatly simplifies the integration of HTML Modules into the current ES Module system since module scripts have defer semantics and we therefore don't need to worry about synchronous script elements causing side-effects during parsing.  This allows us to resolve the entire import graph before executing any script -- which is a key aspect of the ES Modules system.

### Accessing declarative content from within an HTML Module

HTML Modules operate in the same JavaScript realm of the window in which they were imported, and the `document` keyword in an HTML Module's inline script refers to the top-level document (as is the case in Script Modules today).  In order for script in an HTML Module to access the module's own HTML content, we introduce a new `import.meta.document` property that refers to the HTML Module document.  We limit this to **inline module scripts only** because a non-inline module can be imported and run from multiple contexts, making its referrer document ambiguous. Inline scripts are unique to the document into which they are inlined, thus avoiding this problem.

The following example shows how an HTML Module might use `import.meta.document` to access its HTML content and use it to define the shadow DOM for a custom element:

**module.html**
```html
<template id="myCustomElementTemplate">
    <div>Custom element shadow tree content...</div>
</template>

<script type="module">
    let importDoc = import.meta.document;

    class myCustomElement extends HTMLElement {
        constructor() {
            super();
            let shadowRoot = this.attachShadow({ mode: "open" });
            let template = importDoc.getElementById("myCustomElementTemplate");
            shadowRoot.appendChild(template.content.cloneNode(true));
        }
    }

    window.customElements.define("myCustomElement", myCustomElement);
</script>
```

### Specifying an HTML Module's Exports

An HTML Module will specify its exports using its inline script elements.  Inline Script Modules in an HTML Module document will have their exports redirected via the HTML Module Record such that the importer of the HTML Module can access them.  This is done by computing the exports for the HTML Module's record during its instantiation phase as per the following pseudocode:

```javascript
for (ModuleScript in HtmlModuleRecord.[[RequestedModules]]) {
    if (ModuleScript.IsFromInlineScriptElement) {
        export * from ModuleScript;
    }
}
```

This is the fundamental way in which HTML Modules will expose their content to their referrer (the document/module that imported them) -- the HTML Module can take its HTML elements, classes, functions, etc., and export them from any inline script in the HTML Module's document. This allows HTML Modules to operate with the same import/export syntax as ES modules. Note that in the existing ES implementation, exports from an inline Script Module previously had no real use; in this way we grant them one.

Example:

**module.html**
```html
<div id="blogPost">
    <p>Content...</p>
</div>
<script type="module">
    let blogPost = import.meta.document.querySelector("#blogPost");
    export {blogPost}
</script>
```

**blog.html**
```html
<script type="module">
    import {blogPost} from "module.html" with {type: "html"};
    document.body.appendChild(blogPost);
</script>
```

An important aspect of this design is that `<script>` elements in an HTML module, whether they are inline or not, are distinct nodes in the module graph with their own Source Text Module Records.  It is therefore the case that import/export linking for an HTML module behaves similarly to an analogous module graph consisting solely of JavaScript modules.  This can be useful to keep in mind when reasoning about the behavior of certain corner cases; e.g. see [this example](https://github.com/w3c/webcomponents/issues/831#issuecomment-526384109) involving a module graph that contains duplicate exports.

### Default exports

If an inline script element specifies a default export it will be passed through as the default export of the HTML Module (multiple inline scripts specifying a default will result in an instantiation error for the HTML Module).  If no script specifies a default export, the HTML Module's document will be the implicit default export of the module. This will allow declarative content of a module to be consumed without the use of inline script elements in the module to specify exports.

Example:

**module.html**
```html
<template id="myCustomElementTemplate"></template>
```
  **main.html:**
```javascript
import importedDoc from "module.html" with {type: "html"};
let theTemplate = importedDoc.querySelector("template");
```

## Example: Custom Element Definition in an HTML Module

The following example demonstrates how a custom element definition could be packaged as an HTML Module:

[html5Element.html](HTML-Modules-Demo/HTML5-Element.html)

This example demonstrates how the above custom element definition can be consumed:

[main.html](HTML-Modules-Demo/Main.html)

## Major open design questions

The following list is **not** comprehensive of all open issues; the intent here is to highlight questions that could have a significant impact on the shape of the final design depending on the way they are decided.

- Should HTML Modules use a new MIME type, or the existing `text/html`? [[1](https://github.com/w3c/webcomponents/issues/742)]
- How should HTML modules interact with CSP?  In particular, should their inline scripts be allowed to run even without an `unsafe-inline` directive? [[1](https://github.com/w3c/webappsec/issues/544)], [[2](https://discourse.wicg.io/t/proposal-html-modules/3309/2)]
- Should non-`type="module"` scripts in an HTML module yield an error or be implicitly interpreted as module scripts? [[1](https://github.com/w3c/webcomponents/issues/798)]
- Should there be a declarative way to consume HTML modules? [[1](https://github.com/WICG/webcomponents/issues/863)], [[2](https://github.com/w3ctag/design-reviews/issues/334#issuecomment-456319294)]

## Additional information

* [Initial post in GitHub WebComponents modules thread](https://github.com/w3c/webcomponents/issues/645#issuecomment-427205519)
* [Initial HTML Modules proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-modules-proposal.md)
* [Early draft of what the HTML5 and ES6 spec changes will look like](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-module-spec-changes.md).
