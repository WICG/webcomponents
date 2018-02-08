Declarative Shadow DOM
-----
> Proposed by Tomek Wytrębowicz, Starcounter on Feb 6th, 2018

## Abstract

[Shadow DOM](https://www.w3.org/TR/shadow-dom/)  provides a way to build a document as a composition of separated DOM trees. It allows to encapsulate HTML, scope styles, ids and hide pieces of markup from external use. However, so far there is no way to achieve that using pure HTML. JavaScript was required to **imperatively** call `element.attachShadow`, even though there may be no scripting involved in the trees themselves. This document states a proposal for **declarative way** to create shadow roots. To allow to encapsulate HTML within HTML, support non-scripting environments, simplify markup, unify developer experience.

It aggregates the ideas from:
https://discourse.wicg.io/t/declarative-shadow-dom/1904
https://github.com/whatwg/dom/issues/510


## Use cases
### Self-sufficient HTML
Shadow DOM encapsulation allows creating cleaner, more modular HTML documents that have scoped `id`s, hidden `div`-soup, etc. However, an author skilled in HTML, working in environment that supports it, who wants to prepare a document with no interaction or scripting involved, have to learn and enable JavaScript just to support HTML feature.

An HTML document author should be able to use the effects of Shadow DOM on HTML by using only HTML.

### Scoped CSS
There was demand expressed by the community for scoped styles. The separate spec for it was stopped due to scoping mechanism delivered by Shadow DOM. But again, author skilled in CSS and HTML cannot use those features without adding many lines of JavaScript. Sometimes, it's not even possible to run JS due to environment or policy limitations.

HTML & CSS developer, should be able to use CSS scoping using only HTML and CSS

### Non-scripting environments (bots, SEO, disabled-JS)
Since Shadow DOM is available, authors have to pay a significant price for using Shadow DOM. It was making the content non-accessible for web crawlers, web scrapers, other bots, or in various environments that does not support JavaScript. Therefore for publishers that cares about linked open data and SEO, this is simply a reason not to use Shadow DOM at all.

We need a way to use Shadow DOM, in a JS-free environment.

### Server-side rendering
Generating static HTML from JavaScript on the server (so-called server-side rendering) is a technique used to improve the perceived performance, SEO, and the support for non-scripting environments. The result of it is the entire content being available to the web client before loading of any scripts, Custom Elements definitions, upgrading elements, fetching cascade of XHRs, etc.

We need a way to be able to serve shadow roots, of native and custom elements, in a static HTML document and let them upgrade progressively.

### Performance

Using declarative Shadow DOM to create a shadow root allows avoiding the performance overhead of crossing the boundary between HTML and JavaScript.

## Background/Current shape

- Libraries (like Polymer) provide a declarative way to provide Shadow DOM for a custom element,
- [Declarative Custom Elements proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Declarative-Custom-Elements-Strawman.md) provides the declarative way to define the shadow root for a custom element.

   The above two solutions provides valuable sugar layer on top of existing API, but in case of Custom Elements the scripting is often needed anyway - to define the behavior.

   There are, however, times when an author likes to provide a shadow root for an element (native `div`, or custom one) just to create the DOM tree, without any need for custom behaviors or scripting. Defining a custom element every time you need a shadow root is an overhead.

- Most search engines are blind to Shadow DOM,

- In some HTML authoring environments, such as IDEs, content management systems, it is not possible to use nor support Shadow DOM, due to complexity of JavaScript to scripting policy limitations.

- Dev tools, tutorials, spec samples already show the declarative convention like:
   ```html
   <hostelement>
       #shadowroot
           <h2>Shadow Content</h2>
       <h2>Light content</h2>
   </hostelement>
   ```
   However, developers are not able to use that syntax by themselves. It is confusing, that you cannot just copy and paste the example from the spec into your HTML document to see it working.

## Proposed Solution

### Syntax
To create a shadow root declaratively, the `<shadowroot>` element should be used.
```html
<hostelement>
    <shadowroot mode="open">
        <h2>Shadow Content</h2>
        <slot></slot>
    </shadowroot>
    <h2>Light content</h2>
</hostelement>
```

 - The content of `<shadowroot>` should be exactly what imperative Shadow DOM allows.
 - The element should have `mode` attribute set to either `"open"` or `"closed"`
    > Note: If we agree on a default mode for `attachShadow`, we should remove this constraint.

### Behavior

Once parsed should create shadow root in parent element - **host**, and append its own content into there. ([test](https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c#file-declarative-shadow-dom-test-html-L8-L12))

- `host.innerHTML = '<shadowroot>shadow DOM</shadowroot>light DOM'` gets parsed and processed as declarative Shadow DOM and light DOM. ([test](https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c#file-declarative-shadow-dom-test-html-L14-L19))

- Once parsed `<shadowroot>` must not appear in `host.childNodes`, nor `host.children` list. ([test](https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c#file-declarative-shadow-dom-test-html-L21-L27))

  To access shadow root imperatively, use already settled API `host.shadowRoot`, `host.shadowRoot.childNodes`.

- Once parsed `<shadowroot>` must not appear in `host.innerHTML`.

  To access shadow root imperatively, use already settled API `host.shadowRoot`, `host.shadowRoot.innerHTML`.


- `host.appendChild(document.createElement('shadowroot'))` does append `HTMLUnknownElement`. ([test](https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c#file-declarative-shadow-dom-test-html-L29-L39))

  To imperatively attach a shadow root, use `host.attachShadow`.
  > Note, consider throwing an error

- It should have `mode` attribute equal to `open` or `closed`, otherwise it is processed as `HTMLUnknownElement` ([test](https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c#file-declarative-shadow-dom-test-html-L41-L67))

- Scripts in `<shadowroot>` are processed:

    >Note,  Given the `<script>`s added via `.innerHTML` are not executed. The only way to execute the scripts is to have them declaratively stated in the document in first place (in the body or in a template).

    - `document.write` may write into the shadow root.

    > Note, `document.write` should not "break" the encapsulation of closed shadow roots - this script was consciously, declaratively put there. Therefore, it "breaks" it no further than a custom element put into shadow root could break it.


- calling `attachShadow` on the element that already has the shadow root attached by declarative `<shadowroot>` must behave exactly the same as for double imperative call.

    For CustomElement upgrades, one may consider

    ```js
    // Create new shadowRoot, or overwrite existing (server-side rendered) one
    if(!this.shadowRoot){
        this.attachShadow({mode: 'open'});
    }
    this.shadowRoot.innerHTML = 'custom element specific shadow';
    ```
- `<shadowroot>` element cannot be used in the elements that cannot have shadow root (see [the list for imperative API](https://dom.spec.whatwg.org/#dom-element-attachshadow)), in such cases it becomes `HTMLUnknownElement`
    > Note, consider `throw a "NotSupportedError" DOMException.`

- `<shadowroot>` element used in the elements that already have a shadow root must not try to attach Shadow Root and must not appear in `childNodes`.
    > Note, non-normative: it is processed without an error but does nothing.

    #### Example
    It allows to progressively enhance server-side rendered Custom Elements.
    Consider the custom element:
    ```js
    customElements.define('hello-element', class extends HTMLElement{
        constructor(){
            super();
            if(!this.shadowRoot){
                this.attachShadow({mode: 'open'});
            }
            this.shadowRoot.innerHTML = 'Hello <slot></slot>';
        }
    });
    ```
    Then following HTML
    ```html
    <hello-element>
        <shadowroot mode="open">
            Hello <slot></slot>
        </shadowroot>
        World
    </hello-element>
    ```
    Should render "Hello World" regardless if custom element definition was loaded before, after or not at all. Also, in all three cases `helloElement.children` consist only of text nodes `"\n\t","\n\tWorld\n"`.

- Another (valid) `<shadowroot mode="open|closed">` inside the node that already has a parsed `<shadowroot>`, should make the same effect as `<shadowroot>` in the element that already has shadow root.
    > Note, non-normative: it is processed without an error but does nothing.- There should be only one `<shadowroot>` child element, other should be treated as `HTMLUnknownElement`
    > Note, we may consider appending to the existing shadow root, but then we will need to bother about different `mode`s (disregard if different)


- `<shadowroot>` can be used inside the content of a `<template>`. ~~It's also processed during parsing of such template.~~
 `<template>` is inert, therefore it does not attach a shadow root to its parent element until template's content is connected to the document. By that time it's available in `.childNodes` as `HTMLShadowRootElement`.
   - `HTMLShadowRootElement` derives from the `HTMLElement` interface, but without implementing any additional properties or methods.

   > Note, non-normative: `<template>` makes all elements including `<shadowroot>` inert.

    ##### Example
    ```html
    <template>
        <shadowroot mode="open">
            Shadow content
        </shadowroot>
        <span>Light content</span>
    </template>
    ```
    Before this `template` is stamped, `template.content.children.length == 2`. `<shadowroot>` does not attach any shadow, as there is no host yet.
    When the above template is stamped to the document, `<shadowroot>` is being processed (adds content to parent element's shadow root if applicable according to the rules stated above)
    ```html
    <template>
        <host-element>
            <shadowroot mode="open">
                Shadow content
            </shadowroot>
            <span>Light content</span>
        </host-element>
    </template>
    ```
    Before the above `template` is stamped, `template.content.querySelector('host-element').children.length == 2`.
    When the above template is stamped to the document, the custom element's constructor is executed and `<shadowroot>` is  processed (adds content to parent element's shadow root if applicable)
- `<shadowroot>` should be a [scoping element](https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope), and the parser should maintain a stack of insertion points for nested roots.


### Expected behavior tests
Once the requirements settle, I'll provide a simple test for each one.
https://gist.github.com/tomalec/a20af4eee86640defdc7aeccccc78c1c



## Additional benefits
### Performance
Using declarative Shadow DOM to create a shadow root allows avoiding the performance overhead of crossing the boundary between HTML and JavaScript.






## Polyfilling strategies:
Declarative Shadow DOM is not just a sugar layer on top of existing APIs, but a missing feature, so each polyfill strategy will come with a cost.
The most important downside is that **none of the solutions would support non-JS environment**.

1. `template is="declarative-shadow-root"`
    ```html
    <hostelement>
        <template is="declarative-shadow-root">
           <shadowroot mode="open">
               <h2>Shadow Content</h2>
               <slot></slot>
           </shadowroot>
       </template>
       <h2>Light content</h2>
    </hostelement>
    ```
   Pros:
    - Assuming `<template>` element is supported, such syntax will guarantee encapsulation of `<shadowroot>`s content,
   Cons:
    - Support for customized built-ins is controversial - not all browser vendor wants to implement it and it's not supported by all polyfills,
    - Is not using precisely proposed syntax - will not be caught by native support,
    - works only on `connectedCallback`
2. `<shadowroot/><shadow-root>`
    ```html
    <hostelement>
        <shadowroot mode="open">
            <h2>Shadow Content</h2>
            <slot></slot>
        </shadowroot>
        <shadow-root></shadow-root>
       <h2>Light content</h2>
    </hostelement>
    ```
   Pros:
    - Would just work in native environment,
   Cons:
    - Encapsulation may bleed resulting in FOUC,
    - works only on `connectedCallback`


## FAQ
### What about SEO?
As this is declarative and fully in HTML, this is finally the way to declare shadow roots that will reach SEO robots instantly. Even if they did not adopt the latest spec, they could process `<shadowroot>` as any other element. So they will get the content. In the worst case, when robot is not up to date with latest spec, it will interpret this as two disjoint light DOM subtrees, rather than light DOM tree that should get distributed within shadow tree (via `<slot>`s).

100% SEO-safe path for adoption would be to use only **declarative** Shadow DOM and make use of style scoping and encapsulation of div-soup but without content distribution. Then existing SEO engines should do just fine.

With the Declarative Shadow DOM, the HTML-only robots have a chance to catch up with the latest spec, without the need to implement huge JavaScript logic and eventually support Shadow DOM trees.

### Why not `<template shadowroot>`?
"Descendant nodes of declarative shadow dom are effectively NOT inert, from user's perspective".  Also, this is not something that could be used as a template and be stamped multiple times. For more see [github comments](https://github.com/whatwg/dom/issues/510#issuecomment-329672539)

### Why don't we wait for declarative CE first?
Declarative Custom Elements is mostly a sugar on top of what's achievable today. When you are defining a custom element, you usually would like to define some behavior and interaction, therefore you need scripting anyways.

However, there are number of use cases that cannot support, or just don't need any scripting and custom elements at all. You only need to use Shadow DOM features, HTML encapsulation in HTML, non-JS environment.

Right now, there is simply no way to achieve that, and Declarative Custom Elements will not change that either.

### Should we unify syntax with declarative CE?
Definitely. We should have nice and unified syntax for both. However, `<shadowroot>` stands for, in fact, an instance of a tree, while in declarative custom elements we need actually a template to be cloned for every instance of the CE and its shadow root. At the same time, the mechanism to process the contents of both trees are exactly the same. As once CE template is cloned and `<shadowroot>` parsed/appended they are just shadow trees already specified.

They are both using the same mechanism to define document subtree: declarative HTML.

Consider non-JavaScript environment, with single, static and unique HTML element, possibly server-side rendered. To its shadow root, we would like to add a 50% complete progress bar
```HTML
<fancy-spiner aria-busy="true">
    <shadowroot mode="open">
        <style>
          :host, #text{ display: grid; align-items: center; justify-content: center; }
          :host { grid: 5em/5em; }
          div { grid-area: 1/1; }
          .circle { border: 8px solid rgba(244, 126, 12, 0.9); width: calc(100% - 16px); height: calc(100% - 16px);
            border-left-color: transparent; border-radius: 100%; animation: rotation 3s infinite ease-in-out; }
          @keyframes rotation {from {transform: rotate(0deg);} to {transform: rotate(359deg);}}
        </style>
        <div class="circle"></div>
        <div id="text"><slot></slot></div>
    </shadowroot>
    Loading...
</fancy-spiner>
```


Then if we would get JS support, would like to use many instances of such element, add some behavior or interactions to it, it makes perfect sense to make a custom element.

We could consider the following syntax to declaratively define a custom element with shadow root. See [Declarative Custom Elements 2. Creating a Shadow Tree Without Scripts](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Declarative-Custom-Elements-Strawman.md#2-creating-a-shadow-tree-without-scripts)
```HTML
<definition name="percentage-bar">
    <template shadow="closed">
        <div id="progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{root.attributes.percentage.value}}">
            <div id="bar" style="width: {{root.attributes.percentage.value}}%"></div>
            <div id="label"><slot></slot></div>
        </div>
        <style>
            :host { dispaly: inline-block !important; }
            #progressbar { position: relative; display: block; width: 100%; height: 100%; }
            #bar { background-color: #36f; height: 100%; }
            #label { position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; text-align: center; }
        </style>
    </template>
</definition>
```
In above example `<template>` make more sense as by the time it's parsed it should be inert, we don't want to render anything inside `<definition>` element's shadow root. Its content may (or may not) be stamped multiple times in the future.

However, with `<shadowroot>` in place we don't have to trigger entire Custom Elements machinery for every unique shadow host, could render this element on server side,




### Related

- Polyfill via customized built-in (template) https://github.com/tomalec/declarative-shadow-dom
- Polyfill via autonomous custom element https://codepen.io/WebReflection/pen/JMxPdv?editors=0010
