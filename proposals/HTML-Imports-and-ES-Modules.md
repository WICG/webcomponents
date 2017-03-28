# HTML Imports and ES Modules

Once the [`<script type="module">`](https://github.com/whatwg/html/pull/443) support ships in the browsers, the native [ES](https://tc39.github.io/ecma262/) Modules support will come to the Web Platform. Now seems like a good time to consider what this means for [HTML Imports](http://w3c.github.io/webcomponents/spec/imports/). Here are a couple of thoughts and rough ideas.

## Use Cases

*Package a component.* Web components comprise HTML, script, styles, images and other resources. They can be developed independently and composed in the DOM with custom elements and shadow DOM. For this reason it makes sense to keep the markup, styles, etc. of a component together. Web components should be convenient to pull in. Web components may depend on other components. Because they may also depend on script libraries the method of loading should be harmonized with ES modules. ES modules alone are not sufficient ES modules are not a good vehicle for markup and styles which can be parsed, etc. while streaming from the network.

Components should be efficient to load, however efficient loading is not unique to components. So we consider the idea of keeping a component's related resources together a different problem to Web Packaging, HTTP/2, etc.

## Requirements

* Efficient to load and instantiate. It should be possible to asynchronously process HTML and preload dependent resources. It is OK to assume HTTP/2.
* Mixed resources: HTML, CSS, script inline. Also resources out-of-line.
* HTML markup in the module does not appear in the main document; CSS does not apply in the main document. This is analogous to template. Script should run and have access to the DOM of the module, though, because that's the way to set up web components.
* Integrated with ES module loading: ES modules can depend on HTML modules and vice versa.
* Run script. Script can get access to the components' HTML and CSS.
* Run custom elements. For example, a declarative syntax could be built out of custom elements so you'd want those elements to "run".

## Native Integration

As currently designed, HTML Imports appear to *Just Work* with ES Modules.

In this world, we treat them as two distinct things. One is a dependency-aware markup inclusion feature, the other is a fully-featured language primitive. Because they are different, they work happily together, complementing each other's strengths (provided we teach each to recognize the other's dependency graph).

For example, you can have both `<link rel=import>` and `<script type=module>` in your main document:

```html
<link rel="import" href="foo.html">
...
<script type="module" url="bar.js">
```

and you can use *ES Modules* in the *HTML Imports*:

**in index.html:**
```html
<link rel="import" href="foo.html">
```

**in foo.html:**
```html
<script type="module">
// enjoy all benefits of ES Modules here.
import qux from "bar.js";
...
```

Using *HTML Imports* from *ES Modules* is something that is left to the userland libraries/frameworks to figure out.

However, the main problem that I see with this approach is that it keeps the two at arm's length from each other. Any cool toys and improvements that *ES Modules* bring to the table would have to be separately invented for *HTML Imports*. Bugs in either system will need to be fixed separately. We probably don't want that.

## HTML Modules

What if we could reimagine HTML Imports on top of ES Modules? Given that the ES spec was designed to accommodate all kinds of scenarios, it looks like it might be fairly straightforward to just rebuild HTML Imports functionality using the ES Modules plumbing.

The key bit is introducing a concrete [Module Record](https://tc39.github.io/ecma262/#sec-abstract-module-records) subclass, that represents an HTML Import. This will be a peer to the [Source Text Module Record](https://tc39.github.io/ecma262/#sec-source-text-module-records), which is the only concrete *Module Record* subclass defined in the ES spec.

Let's call this subclass the **HTML Module Record**.

There are two ways the *HTML Module Record* could be generated:

1. From the `<link rel="import" href="[url]">` statement (hey, maybe it's even just a `<script type="module" src="[url]">`!), and
2. From the  ES `import` statement.

The HTML spec will handle generation of both, leaning heavily on the `<script type="module">` [plumbing](https://github.com/whatwg/html/pull/443).

It will need to be modified to spit out an *HTML Module Record* for the corresponding `HTMLLinkElement`, following the same "defer-like" semantics as `<script type="module">`. These semantics will need to be adjusted to treat the host HTML document as a module itself: create an *HTML Module Record* for it and list each of these newly created records as `[[RequestedModules]]`.

The *HostResolveImportedModule* method will need to be modified to treat the URLs, ending with `.html` specially (or use content type?). These will also result in creating an *HTML Module Record*.

The record itself will be created by the *ParseHTMLModule* spec operation, which will invoke the HTML parser and construct the HTML Document for the HTML Module, queueing custom element callbacks accordingly. There's a really hairy question of whether this method would be a clean-slate thing, where all legacy scripts (non-modules) have defer-like semantics and how that interacts with the notion of treating the main document as an HTML Module itself. Or maybe even legacy scripts are prohibited entirely? I will conveniently wave my hands here.

The *ParseHTMLModule* operation will also populate *HTML Modules Record* field `[[RequestedModules]]`, which is a list of *ModuleSpecifier*s, one for each `<link rel="import" href="[ModuleSpecifier]">` and `<script type="module" src="[ModuleSpecifier]">`.

Sketching it out further, the *HTML Module Record*'s concrete implementations of the *Module Record* methods could look as follows:

* *GetExportedNames* would only return `default`.

* *ResolveExport* will return the HTML Module's document as the `default` export.

* *ModuleDeclarationInstantiation* will invoke `ModuleDeclarationInstantiation` on  every member in [[RequestedModules]].

* Per ES spec, `ModuleEvaluation` will invoke the `ModuleEvaluation` on the *RequestedModules*, as well as do something good about those custom element callbacks and legacy scripts that were accumulated when running the *ParseHTMLModule* method.

## Rousing Call to Action?

Despite the extreme sketchiness of this, er... sketch, I hope it makes sense (at least to readers familiar with the [ES spec](https://tc39.github.io/ecma262/)) that this approach effectively replaces **all** of the HTML Imports machinery with straight-up ES Modules plumbing and leaves only a handful of HTML-specific bits, integrated harmoniously the way ES Modules gods intended. If we're total overachievers, these bits could potentially be the same bits that power `<script type="module">` in the main document, but that's not strictly a requirement.

The devil is, as usual, in the details. I alluded to this in the few questions, sprinkled through the sketch, but there are definitely more problems to solve.

For example, HTML Imports today use incremental dependency evaluation that enables better parallelization of imports in realistic network conditions. Switching to the ES Modules would mean giving up on that. Granted, ES modules should do this [anyway](https://github.com/whatwg/loader/issues/85).

Similarly, HTML Modules would need to figure out whether to even care about the "legacy scripts". That would mean a breaking change as compared to the current implementation.

However, I am optimistic. Getting everyone together into the same boat means that we are lining up to solve a much more overlapping set of problems and challenges, and I can't help but hope that this means we will get a better product in the hands of developers, sooner.


