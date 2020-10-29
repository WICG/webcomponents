# HTML Modules Proposal

By [@dandclark](https://github.com/dandclark), [@samsebree](https://github.com/samsebree)
with [@bocupp](https://github.com/BoCupp) and [@travisleithead](https://github.com/travisleithead)

HTML Imports can be problematic for developers, and most browsers have avoided adopting HTML Imports in anticipation of a better framework. We believe that this framework should integrate seamlessly with ES6 Modules, and the following HTML Modules proposal aims to address this gap.

This proposal serves two purposes:

	1. Outline issues surrounding HTML Imports
	2. Explain how we propose to address the issues identified

### Core issues with HTML imports:

#### 1. Global object pollution 
Pollution of the global object occurs when the imported document, with all its variables, is brought into the main document.  In an ideal solution, only explicitly exported variables would be exposed to the importer. 
Example:
 

**import.html**
> ```html
>  <p>Import content…</p>
>  <script>
>  let foo = "We should fix HTML Imports";
>  ...
>  </script>
>  ```


**myWebsite.html**

> ```html
> <head>
> <link rel="import" href="import.html">  
> </head>
>  <body>
>     <script>
>         let foo = "HTML Modules Rock!"; // SyntaxError: Identifier 'foo' has already been declared
>         ...
>    </script>
> </body> 
> ```

**Solution:**
If when parsing an HTML Module a script without `type="module"` is encountered, this will be considered a parse error that causes creation of the module to fail.  Thus, an HTML Module can contain only module scripts.  ES6 Modules don't pollute the global scope, as only explicitly exported variables are accessible.

#### 2. Parse blocking with inline script

Currently with HTML Imports, if an importing document has a synchronous script following a `<link rel="import" />`, the browser must wait for the entire HTML Import to load before the subsequent script is run. This is due to the fact that script might potentially depend on components being imported. 

Example:

**myWebsite.html**

> ```html
> <html>
>   <head>
>     <link rel="import" href="/imports/blog-post.html">
>     <script>
>       <!-- Parsing is blocked here until HTML Import is complete, even
>            though the script does not depend on the HTML Import -->
>       console.log("Here is some script that doesn't depend on any HTML imports")
>     </script>
>   </head> 
>   <body>
>     <p>Hello World!</p>
>   </body>
> </html>  
> ```

**Solution:**

This is also addressed by our proposal for [item 1](#1-global-object-pollution): limit HTML Modules to contain `type="module"` scripts only. ES6 Modules have defer semantics and thus don't block the parser.

#### 3. Inability for script modules to access declarative content

Module scripts, when combined with HTML Imports, run into an issue where there is no reasonable way to make a reference to the import document and its declarative content (e.g. template element content). `document.foo` will only ever refer to the root document of the import graph.  A standard way to access declarative content with HTML Imports as they are today would be the following command:

```js
document.currentScript.ownerDocument.getElementById('...');
```

This command will fail in `script type="module"` because `document.currentScript` is null.

**Solution:**

Expose `import.meta.document` -- from inline scripts only.

There is a need to create a new `import.meta.document` property which will allow us to reach the declarative content of the imported document from within a module script. We limit this to **inline module scripts only** because a non-inline module can be imported and run from multiple contexts, making its referrer document ambiguous.  Inline scripts are unique to the document into which they are inlined, thus avoiding this problem.

Example:

**import.html**

> ```html
> <template id="myCustomElementTemplate">
>     <div class="myDiv">
>         <div class="devText">Here is some amazing text</div>
>     </div>
> </template>
> 
> <script type="module">
>   let importDoc = import.meta.document;
>  
>   class myCustomElement extends HTMLElement {
>         constructor() {
>             super();
>             let shadowRoot = this.attachShadow({ mode: "open" });
>             let template = importDoc.getElementById("myCustomElementTemplate");
>             shadowRoot.appendChild(template.content.clone(true));
>         }
>     }
>  
>     window.customElements.define("myCustomElement", myCustomElement);
> </script>
> ```

The module contained within the HTML file uses `import.meta.document` to reference the template element that was declared within its own file. This way, when other files import this module, the module will be able to refer to the template content that it depends on, which couldn't previously be done from a module script.

More in-depth discussion explaining the ideas that lead to the proposal for an `import.meta.document` property:
https://github.com/whatwg/html/issues/1013

#### 4. Redundant dependency resolution infrastructures

ES6 Script modules and HTML Imports use similar graph based systems for resolving dependencies.  However, since they were implemented separately these are two separate models that don’t communicate with one another.  This leads to problems when HTML Imports and ES6 Modules share dependencies (see [this Chromium bug](https://bugs.chromium.org/p/chromium/issues/detail?id=767841) for a discussion of how this can become an issue).  A more unified workstream would also allow new features and bug fixes to be addressed together for both ES Modules and HTML Imports.

**Solution:**

Merge the HTML Imports loading system into the existing ES6 Modules system.

The current system for building a dependency graph of HTML Imports as specified in https://www.w3.org/TR/html-imports/ will need to be changed. Instead, each imported HTML Module will have its own module record as introduced in the ES6 spec and will participate in the ES6 Module map and Module dependency graphs. Like a script module today has a [Source Text Module Record](https://tc39.github.io/ecma262/#sec-source-text-module-records), we will introduce a new subclass of the [Abstract Module Record](https://tc39.github.io/ecma262/#sec-abstract-module-records) type (perhaps "HTML Module Record").  Where a Source Text Module Record contains the script for the module ([[ECMAScriptCode]]), an HTML Module record would contain the import document object, along with its own [[RequstedModules]] list, imports/exports, etc.  As module scripts in the HTML Module are encountered during parse time, they will be added to the HTML Module record's [[RequestedModules]] list, ensuring that they are instantiated/executed prior to their HTML Module's instantiation/execution and that they can export content to be exposed through the HTML Module's record, as explained in [item 5](#5-non-intuitive-import-pass-through) below.

This merge is greatly simplified by our proposed solution to [item 1](#1-global-object-pollution): since HTML Modules can only contain module scripts and all module scripts have defer semantics, we don't have synchronous script elements causing side-effects during parsing. This allows us to resolve the entire import graph before executing any script -- which is a key aspect of the ES6 Modules system.

#### 5. Non-intuitive import pass through

Currently the most common way of importing and accessing HTML elements is through the use of a query selector. By contrast, JavaScript modules offer an `import '...' from '...'` syntax. In an ideal world, importing of HTML would follow a similar syntax as JavaScript modules.

Current HTML Import syntax:

**import.html**

> ```html
> <div id="blogPost">
> 	<p> Amazing Blog Post Content </p>
> </div>
> ```

**main.html**

> ```html
> <link rel="import" href="import.html">
> <script>
> 	let importDoc = document.querySelector("link").import;
> 	let blogPost = importDoc.querySelector("#blogPost");
> 	document.body.appendChild(blogPost);
> </script>
> ```

**Solution:**

Inline script modules in an HTML Module document should have their exports redirected via the HTML Module Record such that the importer of the HTML Module can access them.

This is done by computing the exports for the HTML Module's record during its instantiation phase as per the following pseudocode:

```js
for (ModuleScript in HtmlModuleRecord.[[RequestedModules]]) {
	if (ModuleScript.IsFromInlineScriptElement) {
		export * from ModuleScript;
	}
}
```

This is the fundamental way in which HTML Modules will expose their content to their referrer (the document/module that imported them) -- the HTML Module can take its HTML elements, classes, functions, etc., and export them from any inline script in the HTML Module's document.  This allows HTML Modules to operate with the same import/export syntax as ES modules.  Note that in the existing ES6 implementation, exports from an inline script module previously had no real use; in this way we grant them one.

Example:

**import.html**

> ```html
> <div id="blogPost">
> 	<p> Some Amazing Content </p>
> </div>
> <script>
> 	let blogPost = import.meta.document.querySelector("#blogPost");
> 	export {blogPost}
> </script>
> ```

**blog.html**

> ```html
> <script type="module">
> 	import {blogPost} from "import.html"
> 	document.body.appendChild(blogPost);
> </script>
> ```

This also solves the issue of being unable to efficiently share template HTML between files. With this approach one can import/export templates as needed.

Note that for 'import' statements, we will need to mime-sniff the URL for the import and use the applicable parser based on mime type. 

Additionally, we propose that the HTML Module's document be the implicit default export of the module.  That is, during the HTML Module's instantiation phase, we run an implicit `export default document` (which can be overridden by inline script if desired).  This would allow usage like the following example, where declarative content of a module can be consumed without the use of inline script elements in the module to specify exports.

Example:

**import.html**

> ```html
> <template id="myCustomElementTemplate"></template>
> ```
 
**main.html**

> ```js
> import importedDoc from "import.html"
> let theTemplate = importedDoc.querySelector("template");
> ```
