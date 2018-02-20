Web Components
===============

Web Components are a new browser feature that provides a standard component model for the Web, consisting of several pieces:

- [Shadow DOM](https://w3c.github.io/webcomponents/spec/shadow/)
    - Most of the parts are now maintained in [DOM Standard](https://dom.spec.whatwg.org/).
      Some of the parts are still remained in this repository. See [Issue #661](https://github.com/w3c/webcomponents/issues/661) for the progress.
    - [The current issue tracker](https://github.com/w3c/webcomponents/labels/shadow-dom).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=14978) on W3C bugzilla, which is no longer used.
- [Custom Elements](https://w3c.github.io/webcomponents/spec/custom/)
    - Custom Elements spec is now maintained in [HTML Standard](https://html.spec.whatwg.org/multipage/scripting.html#custom-elements).
      This repository's one is a copy of the relevant parts of HTML Standard.
    - [The current issue tracker](https://github.com/w3c/webcomponents/labels/custom-elements).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=14968) on W3C bugzilla, which is no longer used.
- [HTML Imports](https://w3c.github.io/webcomponents/spec/imports/)
    - [The current issue tracker](https://github.com/w3c/webcomponents/labels/html-imports).
    - [The old issue tracker](https://www.w3.org/Bugs/Public/showdependencytree.cgi?id=20683) on W3C bugzilla, which is no longer used.
    - Note: Although it is still a rough idea, *HTML Modules*, rebuilding HTML Imports functionality using the ES Modules, are now being planned.
      See [HTML Imports and ES Modules](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/HTML-Imports-and-ES-Modules.md) for details.
- HTML Templates
    - HTML Templates were upstreamed into the [HTML Standard](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element).
