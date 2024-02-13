# DOM Part API

This is a joint proposal by Ryosuke Niwa and Theresa O'Connor at Apple and
Justin Fagnani, Mason Freed, Tom Wilkinson, and Yuzhe Han at Google.

## Motivation

The existing specifications that provide the ability to update DOM update after
an initial render are limited. Frameworks can walk the DOM or query for nodes,
and use JavaScript APIs to imperatively update attributes, text content, and
other JavaScript properties of these nodes. However, the framework code that
initially locates DOM that will need to be updated and repeatedly updates that
DOM has not been optimized.

Many frameworks provide specific domain-specific templating languages that
provide a higher level semantic representation of the DOM structure that
includes static parts that never change, dynamic parts that change depending on
data context, and other non-HTML structures like event listeners.

A sampling of frameworks and templating:

1. React, Solid.js, and others use HTML-in-JS
   [JSX](https://react.dev/learn/writing-markup-with-jsx).
1. Angular uses an extension of
   [HTML](https://angular.io/guide/template-overview).
1. Svelte uses a combined HTML/JS
   [template](https://svelte.dev/docs#template-syntax).
1. Lit uses
   [tagged template literals](https://lit.dev/docs/templates/overview/).

There are many other frameworks that similarly have created templating languages
to represent the logic of rendering an HTML component from static strings and
dynamic data. These templating systems are used as blueprints to determine how
to hydrate, render, or update DOM.

The HTML5 specification defines the
[template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
that provides the ability to render HTML with the intention of cloning the HTML.
When it comes to updating the template with dynamic content, the specification
does not provide any assistance and leaves it to the framework to walk or query
the newly rendered DOM. Often, the dynamic boundaries of a template are known
statically, and frameworks have no need to visit static nodes in the cloned DOM.
Additionally, it's up to frameworks to cache the boundaries of these dynamic
portions of the output HTML for later use in update operations if the data
changes in such a way that the HTML needs to update.

When it comes to hydrating HTML that was rendered by a server response,
frameworks have similar needs for locating and updating nodes. Frameworks today
use different strategies to hydrate the DOM after an initial server-side HTML
render, but all use either a DOM query or a DOM walk to visit nodes that require
hydration or later update.

For updating, the methods today are limited to JavaScript APIs to update text
content, modify or add child nodes, add or remove attributes, or call
`HTMLElement` specific APIs. From the perspective of the browser, these updates
are atomic and unrelated. This prevents the browser from being able to take
advantage of knowledge that the framework has, such as whether updates will be
batched. It also creates awkward experiences for frameworks that are trying to
perform operations that aren't easy to make atomic, such as moving an element
with focus.

In general, there's no way to identify arbitrary positions and content in HTML.
Most identifying APIs today are graph based (like child index or parent) or node
property based (`id`, `class`) and require either DOM walks or DOM querying with
worse than constant-time runtime cost for anything other than `id` based
queries. Current identifying APIs also leave out whole classes of HTML content
that cannot be easily identified:

1. Text content
1. Attributes, or content within attributes
1. Positions in between nodes and ranges of nodes (there is a
   [`Range`](https://developer.mozilla.org/en-US/docs/Web/API/Range) but it is
   not performant).
1. Comment nodes.

Being able to identify these types of position and content matters when thinking
about a templating system, but it also matters when thinking about other APIs,
for example a deferred content API which needs to identify a specific insertion
point.

These use cases point to the requirement for a generalized specification that
would allow marking and updating arbitrary positions and content in the DOM and
properties exposed only via JavaScript APIs. This principally serves as a
write-target for template languages, but would also be understandable without a
third-party templating system.

This proposal focuses on the key parts of these use cases:

1. Identifying positions and content as fast as `id` based queries.
1. Updating positions and content as fast as current DOM-update APIs.

## Proposal

This proposal introduces the concept of a **DOM part**, which represents an unit
of mutable state in a DOM tree. It could be a
[content attribute](https://dom.spec.whatwg.org/#concept-attribute) of an
[element](https://dom.spec.whatwg.org/#concept-element),
[child](https://dom.spec.whatwg.org/#concept-tree-child) nodes of a
[node](https://dom.spec.whatwg.org/#concept-node), or even a
[JavaScript property](https://tc39.es/ecma262/#sec-object-type) of an element.

There are a few component pieces to this proposal, so it is easiest to split it
into multiple documents.

1. [Imperative API to construct DOM parts](./DOM-Parts-Imperative.md)
1. [Declarative API to construct DOM parts](./DOM-Parts-Declarative.md)
