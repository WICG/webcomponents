# Web Components

Web Components are a new browser feature that provides a standard component model for the Web, consisting of several pieces maintained in different places:

- Shadow DOM
    - Most of the parts are now maintained in [DOM Standard](https://dom.spec.whatwg.org/), called shadow trees.
      Some of the parts are still remained in this repository. See [Issue #661](https://github.com/w3c/webcomponents/issues/661) for the progress of upstreaming those parts from the partially out-of-date [Shadow DOM](https://w3c.github.io/webcomponents/spec/shadow/) document.
    - [Issues against the DOM and HTML Standard](https://github.com/search?q=org%3Awhatwg+label%3A%22topic%3A+shadow%22+is%3Aopen).
    - [Issues raised in this repository](https://github.com/w3c/webcomponents/labels/shadow-dom).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=14978) on W3C bugzilla, which is no longer used.
- Custom Elements
    - Custom elements were upstreamed into the [HTML Standard](https://html.spec.whatwg.org/multipage/scripting.html#custom-elements) (and bits in the DOM Standard) and are maintained there.
    - [Issues against the DOM and HTML Standard](https://github.com/search?q=org%3Awhatwg+label%3A%22topic%3A+custom%20elements%22+is%3Aopen).
    - [Issues raised in this repository](https://github.com/w3c/webcomponents/labels/custom-elements).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=14968) on W3C bugzilla, which is no longer used.
- HTML Templates
    - HTML Templates were upstreamed into the [HTML Standard](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element) and are fully maintained there.
- CSS changes
    - The CSS WG works on [CSS Scoping](https://drafts.csswg.org/css-scoping/) and [CSS Shadow Parts](https://drafts.csswg.org/css-shadow-parts/), which help dealing with shadow trees with various selectors. Various other parts of CSS and its object model are also impacted by shadow trees and directly worked on in the various CSS specificaions.
    - [Issues against the CSS WG repository](https://github.com/w3c/csswg-drafts/labels/topic%3A%20shadow).
- JSON, [CSS](proposals/css-modules-v1-explainer.md), [HTML](proposals/html-modules-explainer.md) Modules
    - Successor to the abandoned *[HTML Imports](https://w3c.github.io/webcomponents/spec/imports/)*, allows JSON, CSS, and HTML markup to be requested by a component. HTML Modules Spec work is being incubated upstream in whatwg/html (see [PR](https://github.com/whatwg/html/pull/4505)). For new issues, please file against whatwg/html or here in w3c/webcomponents. See also the [HTML Modules explainer](proposals/html-modules-explainer.md), [initial proposal](proposals/html-modules-proposal.md), and [earlier design ideas](proposals/HTML-Imports-and-ES-Modules.md).
    - [Issues raised in HTML Standard](https://github.com/whatwg/html/labels/topic%3A%20html%20modules)
    - [Issues raised in this repository](https://github.com/w3c/webcomponents/labels/modules). Includes related issues for other potential module-types, such as CSS and JSON.
    - [Old issue tracker](https://github.com/MicrosoftEdge/MSEdgeExplainers/issues?q=is%3Aissue+label%3A%22HTML+Modules%22) includes a few issues filed when the feature was first proposed. Please avoid filing new issues there.

## Issues

Please file issues in the most specific repository possible, per the above issue pointers. (It's often not this repository.)

## Abandoned features:

- [HTML Imports](https://w3c.github.io/webcomponents/spec/imports/)
    - [The current issue tracker](https://github.com/w3c/webcomponents/labels/html-imports).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=20683) on W3C bugzilla, which is no longer used.
    - Note: *HTML Modules* are intended to replace *HTML Imports* (see above).
