# CSS Modules V1 Explainer

Author: [@dandclark](https://github.com/dandclark)

## Introduction

This document proposes an extension of the ES Script Modules system to include CSS Modules.  These will allow web developers to load CSS into a component definition in a manner that interacts seamlessly with other module types.

## Why are CSS Modules needed?

The introduction of ES6 JavaScript Modules has provided several benefits for web developers including more componentized code and better dependency management.  However, solutions for including CSS in component definitions are lacking.  Current practices all have one or more of the following rough edges:

* Side effects like appending `<style>` elements to the document.  If this is done in the top-level scope of the document then it breaks shadow root style scoping.  If it is done inside a shadow root then each individual instance of the component must include its own `<style>` element in its shadow root instance.
* Inlined CSS text as a string in JavaScript.  This is not optimally performant (it's processed by both the JS and CSS parsers) and is a poor developer experience.
* Dynamically `fetch()`ing CSS is generally not statically analyzable and requires careful dependency management by the developer for complex applications.

CSS modules solves these issues by extending the ES modules infrastructure to allow importing a CSSStyleSheet object from a CSS file, which can then be added to the document or a shadowRoot via the [adoptedStyleSheets](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets) array.

There is demand for this functionality in the developer community -- see [this thread](https://github.com/w3c/webcomponents/issues/759) where there a number of developers have expressed interest.  The popularity of CSS loaders in JS bundlers is also indicative of demand for this functionality.

## Importing a CSS Module
CSS modules will be imported using the same `import` statements currently used for other ES modules,
with the addition of an [import assertion](https://github.com/tc39/proposal-import-assertions) module type check:

```JavaScript
import styles from "./styles.css" assert { type: "css" };
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
```

The default export of the module is the CSSStyleSheet generated from the CSS file.  A CSS module has no named exports.

If a CSS module `import` in a given module graph fails, it prevents the module graph from executing -- the same behavior as for a JavaScript module.

## Some implementation details

The MIME type in the HTTP response header is checked to determine how a given module should be
interpreted. A resource with a MIME type of `text/css` will be treated as a CSS module. Additionally,
if the MIME type is `text/css` and there is no [asserted module type](https://github.com/tc39/proposal-import-assertions)
or if the asserted module type is something other than `"css"`, the module load will fail. This
prevents a [security issue](https://github.com/w3c/webcomponents/issues/839) where the module type
could unexpectedly change and execute script if the server that owns the module resource starts
responding with a JavaScript MIME type.

Each imported CSS Module will have its own [module record](https://tc39.github.io/ecma262/#sec-abstract-module-records) as introduced in the ES6 spec and will participate in the module map and module dependency graphs.

The V1 of CSS Modules will be built using Synthetic Modules.  Specifically, to create a new CSS module given a fetched `text/css` file:
1. Create a CSSStyleSheet() via the [constructor](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-cssstylesheet).
1. Call [CSSStyleSheet.replaceSync](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replacesync) on the new sheet with the contents of the file as the argument (see [here](#why-is-cssstylesheetreplacesync-used-instead-of-cssstylesheetreplace) for discussion of why this is `replaceSync` rather than `replace`).  An error thrown from this call causes the module creation to fail with a parse error.
1. Create a new Synthetic module via [CreateSyntheticModule](https://heycam.github.io/webidl/#createsyntheticmodule) with `"default"` as the sole entry of `exportNames` and with `evaluationSteps` that calls `SetMutableBinding("default", sheet)` where `sheet` is the CSSStyleSheet created in step 1.
1. Create a new CSS module script with the Synthetic module created in step 3 as its record.

## Why is [CSSStyleSheet.replaceSync](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replacesync) used instead of [CSSStyleSheet.replace](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replace)?

This proposal describes a limited V1 of CSS modules that do not support `@import`s.  The reason for this is that it's not clear whether an `@import` in a CSS module should be treated as its own CSS module in the module graph, or whether CSS modules should be leaf modules.  There are 3 possibilities under consideration:

1. CSS Modules are leaf modules, and don't allow `@import` references (following the example of [replaceSync](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replacesync) in constructable stylesheets).  This is the V1 implementation described in this document, and this is why step 2 of of CSS module creation as described [here](#some-implementation-details) uses [replaceSync](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replacesync) instead of [replace](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replace); [replaceSync](https://wicg.github.io/construct-stylesheets/#dom-cssstylesheet-replacesync) throws if given input containing `@import` rules.
1. CSS modules are leaf modules; prior to creating the module record for a CSS module, load the full `@import` tree of its stylesheet and if any fail to resolve, treat it as a parse error for the module.
    
    a. An alternative with this approach is that `@import`s that fail to load could just be dropped benignly -- as they are with normal CSS -- instead of causing the entire module graph to fail to load.

1. CSS Modules are non-leaf (cyclic) modules. Process a CSS Module's `@import`ed stylesheets as its requested module children in the module graph, with their own module records. They will Instantiate and Evaluate as distinct modules.

Option 1 seems needlessly restrictive in the long-term.

One of the main differences between options 2 and 3 is that 3 implies that if a CSS file is `@import`ed multiple times for a given realm, each import would share a single CSSStyleSheet between them (because a module is only instantiated/evaluated once for a given module specifier). There are potential memory/performance gains to be found here in cases where a developer includes a stylesheet multiple times by mistake or because of shared CSS dependencies. On the other hand, this is a divergence from the existing behavior where multiple @imports of the same .css file each come with their own CSSStyleSheet.

@justinfagnani pointed out [here](https://github.com/w3c/webcomponents/issues/759#issuecomment-490670571),  [here](https://github.com/w3c/webcomponents/issues/759#issuecomment-490692275), and [here](https://github.com/w3c/webcomponents/issues/759#issuecomment-491474158) that the sharing of `@import`ed stylesheets in option 3 could enable scenarios where a tool editing CSS or a theming system could dynamically change the shared sheet and have the changes applied in all the different importers of the sheet.

However, as @tabatkins discussed [here](https://github.com/w3c/webcomponents/issues/759#issuecomment-490685490), option 3 is a significant departure from the current `@import` behavior in a way that can't be reproduced dynamically: the CSS object model can't be used to make multiple sheets depend on a single child stylesheet.  The `.parentStyleSheet` and `.ownerRule` references also pose a problem here as these currently reference only a single sheet and become ambiguous if a sheet were to have multiple importers.

The discussion following [this comment](https://github.com/w3c/webcomponents/issues/759#issuecomment-490256626) contains more extensive discussion of this issue.  Given the lack of consensus on far, we're moving forward with a V1 that sidesteps the question by going with option 1.  This is forward-compatible given that any use of `@import` in a CSS module will prevent the module from loading.  Making progress on this now rather than waiting for a final option 2 vs 3 decision is advantageous given that we can get earlier developer feedback on the feature and a better perspective of how it is used in practice, both of which may help us in making these design decisions.  Additionally, completing a V1 of CSS modules unblocks progress on [HTML modules](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/HTMLModules/designDoc.md).

## Example: Custom Element Definition using CSS Modules

The following is an example of how a custom element might be defined today, where CSS is included inline as a JavaScript string:

```JavaScript
<!doctype html>
<html>
    <head>
        <script type="module">
            class HTML5Element extends HTMLElement {
                constructor() {
                    super();
                    let shadowRoot = this.attachShadow({ mode: "open" });

                    let style = document.createElement("style");
                    style.innerText = `
                        .outerDiv {
                            border:0.1em solid blue;
                            display:inline-block;
                            padding: 0.4em;
                        }

                        .devText {
                            font-weight: bold;
                            font-size: 1.2em;
                            text-align: center;
                            margin-top: 0.3em;
                        }

                        .mainImage {
                            height:254px;
                        }
                        `;

                    let outerDiv = document.createElement("div");
                    outerDiv.className = "outerDiv";
                    let mainImage = document.createElement("img");
                    mainImage.className = "mainImage";
                    mainImage.src = "https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png";
                    let devText = document.createElement("div");
                    devText.className = "devText";
                    devText.innerText = "CSS Modules Are Great!";

                    this.shadowRoot.appendChild(outerDiv);
                    outerDiv.appendChild(mainImage);
                    outerDiv.appendChild(devText);
                    this.shadowRoot.appendChild(style);
                }
            }

            window.customElements.define("my-html5-element", HTML5Element);
        </script>
    </head>
    <body>
        <my-html5-element></my-html5-element>
    </body>
</html>
```

The following example shows how the same custom element definition could incorporate a CSS module to avoid CSS-as-a-JS-string (or inserting a `<style>` tag, etc.):

```JavaScript
<!doctype html>
<html>
    <head>
        <script type="module">
            import styles from './html5Element.css' assert { type: 'css' };

            class HTML5Element extends HTMLElement {
                constructor() {
                    super();
                    let shadowRoot = this.attachShadow({ mode: "closed" });

                    this.shadowRoot.adoptedStyleSheets = [styles];

                    let outerDiv = document.createElement("div");
                    outerDiv.className = "outerDiv";
                    let mainImage = document.createElement("img");
                    mainImage.className = "mainImage";
                    mainImage.src = "https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png";
                    let devText = document.createElement("div");
                    devText.className = "devText";
                    devText.innerText = "CSS Modules Are Great!";

                    shadowRoot.appendChild(outerDiv);
                    outerDiv.appendChild(mainImage);
                    outerDiv.appendChild(devText);
                }
            }

      window.customElements.define("my-html5-element", HTML5Element);
       </script>
    </head>
    <body>
        <my-html5-element></my-html5-element>
    </body>
</html>
```
