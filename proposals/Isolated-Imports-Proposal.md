# A Proposal for Fully Isolated Components

Much controversy about Web Components has been about what levels of encapsulation to provide. The strongest level of encapsulation is what I will call "fully isolated", which refers to components that can meet the following safety properties: 

1. The component embedder cannot access the component implementations internal implementation details (including shadow DOM and script state). This can't be done by accident, or even through deliberate trickery such as monkeypatching DOM methods.

2. The component provider cannot access the embedding document’s DOM or script state, even through trickery.

3. The component embedder and provider cannot execute code in each others’ script environments or get access to information they shouldn't, even through trickery such as JS objects that aren’t what they appear to be and have creatively defined methods.

4. The component embedder and provider can be in separate security origins and do not gain the privilege of each others' origins.

5. Message passing of some form from inside to outside can still be done,  as long as data passed across the boundary is guaranteed safe.

In this proposal, I outline a strategy for supporting fully isolated components using Web Components technologies, including some new technical proposals.

# Use Cases

Fully isolated components would be extremely useful for cases of cross-site mutually untrusted embedding. For example:

- Advertising
- Social media gadgets such as “like” or “tweet this” buttons
- Video embedding from hosting services
- Browser engine implementations of built-in elements, or high-fidelity polyfills

Currently, use cases such as this are handled with direct cross-origin execution of offsite script, offsite script restricted to JS subsets like ADSafe or Caja, iframes, or non-standard browser-specific magic.

Advantages over direct inclusion of script:

- Actually secure

Advantages over inclusion of restricted JS subsets:

- No need for complex script to ensure safety
- Security guarantees in both directions

Advantages over iframes:

- No need for a separate browsing context and global object per iframe.
- The API to the component could be nicer than just a postMessage()-based protocol.

Advantages over browser-specific magic:

- Explains the platform
- Usable by frameworks for high-fidelity polyfills or for making true equivalents of built-in elements

# Roadmap

The Web Components technology stack is tantalizingly close to being able to serve this use case. We need the follow already specified, formerly proposed(`*`), or proposed-here(`**`) technologies:

1. [Shadow DOM](http://w3c.github.io/webcomponents/spec/shadow/)
2. [Custom Elements](http://w3c.github.io/webcomponents/spec/custom/)
3. [HTML Imports](http://w3c.github.io/webcomponents/spec/imports/)
3. [“closed” mode for Shadow DOM](https://www.w3.org/Bugs/Public/show_bug.cgi?id=20144) (`*`)
4. [Named Parts for Shadow DOM styling](https://lists.w3.org/Archives/Public/www-style/2014Feb/0621.html) (`*`)
5. Isolated Imports (`**`)
6. Foreign Custom Elements (`**`)

This proposal will explain how it all fits together after explaining the two newly-proposed technologies.

# Isolated Imports

Isolated imports are a form of HTML imports that give the import its own JavaScript global object, and effectively its own pseudo-browsing context.

Straw man syntax proposal:

```
<link rel="isolated-import" href="http://other-server.example.com/component-library.html">
```

An isolated import functions just like a normal HTML import, except that its scripts (and scripts of its own non-isolated imports) all execute in a separate global object, instead of in the main browsing context. There is no direct access to the importing document or global object. The scripting context’s origin is that of the URL it is loaded from.

An isolated import may be cross origin.

Isolated imports do not expose a document property on the link element used to embed.

Rationale: HTML imports cannot reasonably be used for fully isolated components, because they run the content provider’s script and the content embedder’s script in the same global object. This makes it impossible for the import provider to protect anything in its scripting world, since the importer or a previous import could have used prototype hacking or redefinition of globals to set traps. Likewise, it’s very hard for the importer to protect against the import provider. The only known way to do this without a separate global object is to run script in a Caja-style restricted scripting environment. That’s very hard to get right, and HTML imports as they stand have no way to do that.

Isolated imports solve this by running all script in a separate global object.

Some possible alternate rel names: `foreign-import`, `safe-import`.


# Foreign Custom Elements

Isolated imports by themselves can't do anything very useful. Foreign Custom Elements define three features on top of custom elements that make isolated imports useful.

## Controlled custom element exports.

Documents meant to be imported should have a way to specify which custom element definitions they want to export to embedders. Strawman proposal:

```
document.exportElements("custom-xbox", "custom-xbox", "custom-tabview", "custom-gridview", …)
```
Rationale: an import document should be able to use helper custom elements as part of their implementation without necessarily making them directly usable for importers. Likewise it should be able to import a library of custom elements as part of its implementation without necessarily re-exporting all of it.

Some possible alternate names: `document.exportCustomElements`, `document.exportElementDefinitions`, `document.exportDefinitions`, `document.export`, `document.exportElement`. The singular version would take only one element name instead of an arbitrary number.

Possible extension: `document.exportElements("*")` to export all definitions.

Another possibility is a declarative syntax. But that would seem mismatched and awkward to use, given that `document.registerElement` is imperative.

## Controlled custom element imports

Documents that do an import should be able to control what they import into their namespace, for conflict resolution and to limit the risk of breaking when its component library adds new names.

Strawman syntax:

```
<link rel="isolated-import" import-elements="custom-vbox custom-xbox" href="http://other-server.example.com/component-library.html">
```
This would import the custom element definitions for only `custom-xbox` and `custom-xbox`, assuming they are exported by `component-library.html`.

```
<link rel="isolated-import" import-elements="*" href=“http://other-server.example.com/component-library.html”>
```

This would import all exported custom element definitions from `component-library.html`.

```
<link rel="isolated-import" prefix="foobar" import-elements="custom-vbox custom-hbox" href=“http://other-server.example.com/component-library.html">
```

This would import the custom element definition exported as `custom-xbox`, but registered as `foobar-vbox` in this document. Likewise for `custom-xbox` and `foobar-hbox`.

Lots of name and syntax variations are possible. This is the main way in which isolated imports would be useful - they can be used to import component definition from the other scripting environment.

Possible alternative: imports could be done programmatically instead of declaratively. That would require an interface on HTMLLinkElement with an `importElement` method, and authors would have to wait until the import load is done to import element definitions. That seems more awkward, despite the lack of symmetry with programmatic export.

## A two-way membrane proxy around foreign custom element instances.

When a custom element is instantiated from a definition that was imported from an isolated import, script and DOM isolation is enforced at the boundaries. Here is an approximation of what would need to happen:

- The DOM node for the element is created in the importer’s global object and document.
- Script for the constructor or any other callbacks is run in the global object of the isolated import, not the embedding document.
- Content in the custom element’s shadow DOM is created in the isolated import’s global object and document.
- The custom element’s wrapper around its hosting DOM node does not allow access to parentNode, ownerDocument, or any other property that would allow escaping into the ancestor DOM.
- In the hosting document, the DOM wrapper for the DOM node that the custom element is attached to is a proxy. The proxy enforces that all attribute and method access does safe value translation at the boundaries, using an extended form of the structured clone algorithm:
- The structured clone algorithm is extended to be able to translate the types defined in DOM Core, by translating to the appropriate wrapper in the other script environment. Note: this implies that no “expando” properties or prototype hacks are carried across.
- Extended Structured Clone (ESC) is applied to parameters passed to methods called on the custom element by the embedder.
- ESC is applied to return values from methods of the custom element.
- ESC is applied to values passed into or out of getters or setters defined by the custom element.
- ESC is applied to Event objects that cross the shadow boundary.
- Event handler attributes (e.g. “onclick”) parse and execute their script in the context of the embedding document.


# How does this all solve the fully isolated use case?

Closed shadow DOM protects the custom element’s Shadow DOM from obvious direct poking. Isolated imports ensure that even tricky techniques like prototype hacking cannot get at the Shadow DOM or the custom element’s script environment. Foreign custom elements ensure that component embedders can control what is added to their namespace, and component providers can control what they expose. They also ensure that custom elements can have a rich scripting API without risk posed by poisoned JS values.

Also, a single import could be used to instantiate multiple gadgets on the page, with full script isolation, but only one extra global object.

On the whole, this program provides the isolation power of XBL2, but still nicely factored into separate technologies.

# Other Details to be Worked Out

There are probably security attack vectors not considered here. A more detailed spec and/or an implementation would help flush them out.

What happens if a foreign component tries to insert children into its own light DOM? Is there a design where this issue doesn't even arise?

Should a cross-origin isolated import require CORS?

# References

Ryosuke Niwa previously suggested a similar form of isolated imports as a replacement for HTML Imports:
<https://lists.w3.org/Archives/Public/public-webapps/2013OctDec/0418.html>

Maciej Stachowiak previously suggested this approach to fully isolated components as a super rough sketch: <https://lists.w3.org/Archives/Public/public-webapps/2014JulSep/0024.html>

Adam Barth said that Blink was considering a similar approach for some of Blink’s built-in elements.  I agree with Adam that script isolation is the hardest part to define thoroughly.<https://lists.w3.org/Archives/Public/public-webapps/2014JulSep/0038.html>
