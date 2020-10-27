# DOM Part API - First Step of Template Instantiation

This is a joint proposal by Ryosuke Niwa and Theresa O'Connor at Apple and Justin Fagnani, Mason Freed, and Yuzhe Han at Google.

## Motivation

The HTML5 specification defines the [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
but doesn't provide a native mechanism to instantiate it with some parts of it substituted,
conditionally included, or repeated based on JavaScript values
&mdash; unlike popular JavaScript frameworks such as [Ember.js](https://guides.emberjs.com/v2.16.0/templates/)
and [Angular](https://angular.io/guide/template-syntax) allow.

In 2017, [Apple proposed the Template Instantiation API](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md),
a Web API to parameterize a template instance and allow interpolation of JavaScript data during the initial instantiation as well as in subsequent updates.

Reflecting on many feedbacks we've received including whether such as
us having to [ensure API materially improves the platform at all](https://github.com/w3c/webcomponents/issues/704),
this refined proposal focuses on the essence of the previous proposal:
[`NodeTemplatePart`](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#46-nodetemplatepart-interface)
and [`AttributeTemplatePart`](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#45-attributetemplatepart-interface)
which provide mechanisms to insert or replace content at a specific location in a DOM tree.
We've heard from multiple library and framework authors that such API, if designed right,
can be adopted and reduce the amount of code they have to write.
The fact there is a [similar proposal made by a framework author](https://github.com/whatwg/dom/issues/736) gives us confidence
that extracting the essence of `NodeTemplatePart` and `AttributeTemplatePart` would bring a material benefit to the platform
while paving our way for the full declarative syntax for custom elements.

As such, this proposal foregoes the previously controversial parts of the proposals:
a standard syntax for data interpolations, conditionals, and loops, and a mechanism
to define different types of template processing model that are needed to address
[all the use cases mentioned in the old proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#2-use-cases) to a future extension.

## Proposal

We introduce the concept of a **DOM part**, which represents an unit of mutable state in a DOM tree.
It could be a [content attribute](https://dom.spec.whatwg.org/#concept-attribute) of an [element](https://dom.spec.whatwg.org/#concept-element),
[child](https://dom.spec.whatwg.org/#concept-tree-child) nodes of a [node](https://dom.spec.whatwg.org/#concept-node),
or even a [JavaScript property](https://tc39.es/ecma262/#sec-object-type) of an element.
A *DOM part* is represented by the `Part` interface.
It has one property named "value" of [*any* type](https://heycam.github.io/webidl/#idl-any).

When a new value is set or assigned to a *DOM part*,
the change does not immediately reflect back to the corresponding [node](https://dom.spec.whatwg.org/#concept-node),
its [attributes](https://dom.spec.whatwg.org/#concept-attribute),
or its [properties]((https://tc39.es/ecma262/#sec-object-type))
Instead, the new value is staged to be later committed in a batch,
which is defined by an ordered set of *DOM parts* called **DOM parts group**.
Each *DOM part* may belong to at most one *DOM part group*.
This batching reduces the runtime overhead of constantly returning control back from browser's implementation to JavaScript
between each DOM mutation and allows browser engine's to avoid or batch certain sanity checks and housekeeping tasks.

In the [old proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#3-proposal),
a *DOM part group* was represented by a [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element).
This proposal keeps that approach possible but does not keep it the sole approach possible.

### Interfaces

```webidl
interface Part {
    attribute any value;
    void commit();
};

interface NodePart : Part {
    readonly attribute Node node;
};

interface AttributePart : Part {
    constructor(Element element, DOMString qualifiedName, DOMString? namespace);
    readonly attribute DOMString prefix;
    readonly attribute DOMString localName;
    readonly attribute DOMString namespaceURI;
};

interface ChildNodePart : Part {
    constructor(Node node, Node? previousSibling, Node? nextSibling);
    readonly attribute Node parentNode;
    readonly attribute Node? previousSibling;
    readonly attribute Node? nextSibling;
};
```

In the most basic level, this proposal consists of two *DOM parts*:
`AttributePart` represents a single [attribute](https://dom.spec.whatwg.org/#concept-attribute) which can be set
and `ChildNodePart` represents a sequence of [child](https://dom.spec.whatwg.org/#concept-tree-child) [nodes](https://dom.spec.whatwg.org/#concept-node)
of a [node](https://dom.spec.whatwg.org/#concept-node) which can be [replaced](https://dom.spec.whatwg.org/#concept-node-replace).

### Basic Examples

Suppose we had the following template where `{name}` and `{email}` are locations of our interests:
```html
<section><h1 id="name">{name}</h1>Email: <a id="link" href="mailto:{email}">{email}</a></section>
```

And we've parsed the following HTML so far (future extensions will make this parsing possible without extra JavaScript code):
```html
<section><h1 id="name"></h1>Email: <a id="link" href=""></a></section>
```

Then we can create `ChildNodePart` for [`h1` element](https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements)
and [`a` element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
and `AttributePart` for [`a` element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element) as follows: 
```js
namePart = new ChildNodePart(name)
emailPart = new ChildNodePart(link)
emailAttributePart = new AttributePart(link, 'href')

Then assigning values as follows will update the DOM:
namePart.value = "Ryosuke Niwa"
emailPart.value = "rniwa@webkit.org"
emailAttributePart.value = "mailto:rniwa@webkit.org"
namePart.commit();
emailPart.commit();
emailAttributePart.commit();
```

The resultant DOM will look like this:
```html
<section><h1 id="name">Ryosuke Niwa</h1>Email: <a id="link" href="mailto:rniwa@webkit.org"></a></section>
```

### Example with Templates

Suppose we had the following [template](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element):
```html
<template id="t1"><section><h1 id="name">{name}</h1>Email: <a id="link" href="{emailAddress}">{email}</a></section></template>
```

We can create [clone](https://dom.spec.whatwg.org/#concept-node-clone)
its [content](https://html.spec.whatwg.org/multipage/scripting.html#template-contents)
and create *DOM parts* as follows:
```js
const instance = document.importNode(t1.content, /* deep */ true);
const parts = createParts(instance);
container.appendChild(instance);

function createParts(node, parts = {}) {
    const add = (replaceable, part) => {
        parts[replaceable.substring(1, replaceable.length - 1)] = part;
    }
    if (node.nodeType == Node.TEXT_NODE && node.data.match(/^\{\w+\}$/)) {
        add(node.data, new ChildNodePart(node.parentNode, node.previousSibling, node.nextSibling));
        node.remove();
        return;
    }
    for (const attr of (node.attributes || [])) {
        if (attr.value.match(/^\{\w+\}$/)) {
            add(attr.value, new AttributePart(node, attr.name, attr.namespaceURI);
            attr.value = ‘';
        }
    }
    for (const childNode of node.childNodes)
        createParts(childNode, parts);
    return parts;
}
```

After running this code, `instance` would contain a DOM tree equivalent of:
```html
<section><h1 id="name"></h1>Email: <a id="link" href=""></a></section>
```

Then we can assign values to various parts we've just created as follows:
```js
updateParts(parts, {name: "Ryosuke Niwa", email: "rniwa@webkit.org", "emailAddress": "mailto:rniwa@webkit.org"})

function updateParts(parts, object) {
    for (const name in object) {
        const part = parts[name];
        if (part) {
            part.value = object[name];
            part.commit();
        }
    }
}
```

which will update the DOM tree of instance to the equivalent of:
```html
<section><h1 id="name">Ryosuke Niwa</h1>Email: <a id="link" href="mailto:rniwa@webkit.org">rniwa@webkit.org</a></section>
```

We can call `updateParts` many times over after this point,
and the same DOM tree would get updated according to the values of the object passed to updateParts.

## Partial Attribute Updates

Note in that above example, [`href` attribute](https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-href)
had initially contained `mailto: before `{email}` but we could not capture this prefix in the attribute value
because `AttributePart` could only set the whole attribute value.
One native solution for this limitation is to add the support for specifying a prefix or an offset within the attribute value like so:
```js
emailAttributePart = new AttributePart(link, 'href', {'prefix': 'mailto:'})
```

or:
```js
emailAttributePart = new AttributePart(link, 'href', 7)
```

However, this approach falls apart once when we have multiple parts within a single attribute
since prefix or offset depends on the present value of other parts. e.g.
```html
<section><h1 id="name" title="{lastName}, {firstName}">{name}</h1></section>
```

To facilitate cases like this, [`AttributeTemplatePart` in the old proposal](https://github.com/rniwa/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#45-attributetemplatepart-interface)
had a concept of [attribute value setter](https://github.com/rniwa/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#41-attribute-value-setter),
which takes the values of all parts involved for each [content attribute](https://dom.spec.whatwg.org/#concept-attribute)
and sets a single string value by concatenating them upon committing.

This approach worked in the old proposal because
the [browser engine was parsing](https://github.com/rniwa/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#43-creating-template-parts)
a [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)'s mustache syntax
and generated a group of `AttributeTemplatePart` together.
The same approach can't be taken in the world we're introducing `AttributePart` as a primitive API.

Here, we consider a few alternatives.
We can create a group of `AttributePart` together and implicitly relate them, create a specific `AttributePartGroup` object,
or create a new class like `PartialAttributePart` which works together to set a single value using an `AttributePart`.

### Option 1. Create Multiple `AttributePart`s Together

In this approach, `AttributePart` gets a new static function which creates
a list of `AttributePart`s which work together to set a value when the values are to be committed:

```js
const [firstName, lastName] = AttributePart.create(element, ‘title', null, [null, ' ', null]);
// Syntax to be improved. Here, a new AttributePart is created between each string.
```

* **Pros**: Simplicity.
* **Cons**: Coming up with a nice syntax to create a sequence of AttributePart and string can be tricky.

### Option 2. Introduce `AttributePartGroup`

In this approach, we group multiple `AttributePart`s together by creating an explicit group:
```js
const firstName = new AttributePart();
const lastName = new AttributePart();
const group = AttributePartGroup(element, ‘title');
group.append(firstName, ‘ ', lastName);
```

This is morally equivalent to option 1 except there is an explicit grouping step.

* **Pros**: Nicer syntax by the virtue of individual "partial" `AttributePart`'s existence at the time of grouping.
    Code that assigns values to `AttributePart` only needs to know about `AttributePart`
* **Cons**: More objects / complexity. `AttributePart` will have two modes.

### Option 3. Introduce `PartialAttributePart`

Unlike option 2, this creates `PartialAttributePart`s from `AttributePart`,
meaning that `AttributePart` in option 3 plays the role of `AttributePartGroup` in option 2:

```js
const firstNamePartial = new PartialAttributePart();
const lastNamePartial = new PartialAttributePart();
const part = AttributePart(element, ‘title');
part.values = [firstNamePartial, ‘ ', lastNamePartial];
```

* **Pros**: Nicer syntax by the virtue of individual `PartialAttributePart`'s existence at the time of grouping.
    `AttributePart` just knows one thing to do: to set the whole content attribute value.
* **Cons**: More objects / complexity. Code that uses a template has to deal with two different kinds of objects:
    `PartialAttributePart` and `AttributePart`.

## Partial Child Updates

Like partial attribute updates, when there are multiple points of interests
under a single [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [node](https://dom.spec.whatwg.org/#concept-node),
and they're next to each other, nextextSibling / previousSibling / nodeIndex
does not adequately describe a specific location in the DOM when other parts [insert](https://dom.spec.whatwg.org/#concept-node-insert)
or [remove](https://dom.spec.whatwg.org/#concept-node-remove) [children](https://dom.spec.whatwg.org/#concept-tree-child).
Again, the three options mentioned above apply as well as one more option:

### Option 1. Create Multiple `ChildNodePart`s Together

In this approach, `ChildNodePart` gets a new static function
which creates a list of `ChildNodePart`s which work together to set a value when the values are to be committed:

```js
const [firstName, lastName] = ChildNodePart.create(element, null, null, [null, ' ', null]);
```

* **Pros**: Simplicity.
* **Cons**: Coming up with a nice syntax to create a sequence of `ChildNodePart` and string can be tricky.

### Option 2. Introduce `ChildNodePartGroup`

In this approach, we group multiple `ChildNodePart`s together by creating an explicit group:

```js
const firstName = new ChildNodePart();
const lastName = new ChildNodePart();
const group = ChildNodePartGroup(element, null, null);
group.append(firstName, ‘ ', lastName);
```

This is morally equivalent to option 1 except there is an explicit grouping step.

* **Pros**: Nicer syntax by the virtue of individual "partial" `ChildNodePart`s existence at the time of grouping.
    Code that sets new children to `ChildNodePart`s only needs to know about `ChildNodePart`.
* **Cons**: More objects / complexity. `ChildNodePart` will have two modes.

### Option 3. Introduce `PartialNodeChildPart`

This creates `PartialNodeChildPart` from `ChildNodePart`:

```js
const firstNamePartial = new PartialNodeChildPart();
const lastNamePartial = new PartialNodeChildPart();
const part = NodeChildPart(element, null, null);
part.values = [firstNamePartial, ‘ ', lastNamePartial];
```

* **Pros**: Nicer syntax by the virtue of individual `PartialChildNodePart`s existence at the time of grouping.
* **Cons**: More objects / complexity.
    Code that uses a template has to deal with two different kinds of objects: `PartialChildNodePart` and `ChildNodePart`.

### Option 4. Allow `nextSibling` and `previousSibling` to point to another `ChildNodePart`

We would update `ChildNodPart` interface as follows and allow `previousSibling` and `nextSibling` to point to another `ChildNodePart` as well as `Node`:

```webidl
interface ChildNodePart : Part {
    constructor(Node node, (Node or ChildNodePart)? previousSibling, (Node or ChildNodePart)? nextSibling);
    readonly attribute Node parentNode;
    readonly attribute (Node or ChildNodePart)? previousSibling;
    readonly attribute (Node or ChildNodePart)? nextSibling;
};
```

Then we can insert two consecutive `NodeChildPart`s by relating them in the constructor as follows:

```js
const firstName = new NodeChildPart(element);
const lastName = new NodeChildPart(element, firstName);
element.append(firstName, lastName); // For illustration purposes, there is no space between the two parts.
```

Note that `lastName` takes `firstName` as the previous sibling but `firstName` doesn't `lastName` as the next sibling
(since `lastName` doesn't exist at that point in time).
This would mean that we'd have to do a bit of implicit updating of previous/next sibling of other parts in the constructor.

An alternative is to add an explicit API to chain multiple parts togethers:
```js
const firstName = new NodeChildPart(element);
const lastName = new NodeChildPart(element);
ChildNodePart.chain(firstName, lastName);
element.append(firstName, lastName); // For illustration purposes, there is no space between the two parts.
```

* **Pros**: API simplicity. Only `NodeChildPart` is involved but construction isn't as awkward as option 1.
* **Cons**: "Chained" `NodeChildPart` must coordinate when applying mutations.

## Updating JS Property / Invoking Setter

Adding the support to set a [JavaScript property](https://tc39.es/ecma262/#sec-object-type) on,
or invoking the [setter](https://tc39.es/ecma262/#table-accessor-property-attributes) of,
a [DOM node](https://dom.spec.whatwg.org/#concept-node) poses an unique challenge
but it has been [one of the most consistent feedback](https://github.com/w3c/webcomponents/issues/810).
A naive approach can reduce or eliminate the benefit of batching multiple DOM mutations together
since invoking JavaScript forces the browser engine to update all its internal states to a consistent state prior to any script execution.
On the other hand, re-ordering so that all JavaScript related operations happen at the end
can cause a [JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes)
to override [content attributes](https://dom.spec.whatwg.org/#concept-attribute) which appear later in the markup,
which would be a confusing behavior for users of a template engine.

This proposal attempts to solve this issue by delaying JavaScript execution until all DOM mutations are done
but interleaving [custom element callback reactions](https://html.spec.whatwg.org/multipage/custom-elements.html#callback-reaction) in-between setter calls.
This ensures [custom element callback reaction](https://html.spec.whatwg.org/multipage/custom-elements.html#callback-reaction)
for [attribute changes](https://dom.spec.whatwg.org/#handle-attribute-changes) and setter calls occur in the order they are scheduled.

To achieve this observable behavior, when a *DOM part* of this type, let us call it `PropertyPart`,
appears on an [element](https://dom.spec.whatwg.org/#concept-element),
we insert a new kind of an item into the [element](https://dom.spec.whatwg.org/#concept-element)'s
[custom element reaction queue](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-reaction-queue).
This new kind of item, let us call it **property reaction**,
is simply an arbitrary entry point back to the code which invokes
the [JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes)
unlike other items in the queue which involves some predefined method passed to
[`customElements.define`](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define).

Consider two `AttributePart`s and `PropertyPart` which all work an [element](https://dom.spec.whatwg.org/#concept-element) `A`,
and another set of `AttributePart` and `PropertyPart` for another [element](https://dom.spec.whatwg.org/#concept-element) `B`,
and a sequence of updates as shown below where each A* and B* are `AttributePart`s and `PropertyPart`s for respective elements:

```js
BProp.value = ‘foo';
AAttr1.value = ‘foo';
BAttr.value = ‘foo';
AProp.value = ‘foo';
AAttr2.value = ‘foo';
```

Recall that these assignments to *DOM parts* simply stage values to be set when the *DOM part group*s later commit these changes.
It has a queue unique to each element of the "staged" *DOM parts* with pending mutations.
In this case: `[AAttr1, AProp, AAttr2]` for `A` and `[BProp, BAttr]` for `B`.
Suppose `A` appears before `B` in the *DOM part group* all these DOM parts belong.
Then as the browser engine makes DOM mutations for `AAttr1` and `AAttr2` on `A`,
it also schedules a *property reaction* for `AProp` between the two.
It would then schedule a *property reaction* for `BProp` then makes DOM mutation for `BAttr`.

If `A` is a [custom element](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element),
then the following sequence of events will take place:

* `attributeChangedCallback` for `AAttr1` gets invoked.
*  *Property reaction* and therefore the corresponding [JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes) for `AProp` gets invoked.
* `attributeChangedCallback` for AAttr1 gets invoked.

The *property reaction* of `PropertyPart` simply invokes [`Set(O, P, V, Throw)`](https://tc39.es/ecma262/#sec-set-o-p-v-throw) on `A`.
With this in mind, `PropertyPart`'s interface could simply be:

```webidl
interface PropertyPart : Part {
    constructor(Node node, DOMString propertyName);
    readonly attribute propertyName;
}
```

Since the mechanism of invoking a *property reaction* is generic enough to execute arbitrary scripts,
not just [`Set(O, P, V, Throw)`](https://tc39.es/ecma262/#sec-set-o-p-v-throw),
we could generalize it to support arbitrary code execution like this:

```webidl
callback CustomPartCallback = undefined (Node node, CustomPart part);
interface CustomPart : Part {
    constructor(Node node, CustomPartCallback callback);
}
```

## Batching: Template or Not

In [the old proposal](https://github.com/rniwa/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#3-proposal),
the [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
was a natural aggregator of all the pending mutations and batch them together in a lump sum.
`TemplatePart` being tied to a template element has been one of the most persistent complaints by web developers as well,
and there have been multiple alternate proposals in this arena.

We would like for `Part`-only API to still provide the ability to batch multiple mutations for the added performance gain.
This will also avoid having to create two versions of API:
one for declarative custom elements using a template with the performance benefit, and another separate per-`Part` mutation API.

One alternative is to make the concept of DOM part group a real DOM [interface](https://heycam.github.io/webidl/#idl-interfaces):

```webidl
interface PartGroup {
    constructor(sequence<Part> parts);
    readonly attribute FrozenArray<Part> parts;
    void commit();
}
```

Note that if we allow a single `Part` to belong to multiple `PartGroup`s,
the first `PartGroup` which commits the changes would apply the mutations.
In effect, this allows non-[partitioned](https://en.wikipedia.org/wiki/Partition_of_a_set) grouping of `Part` objects to be committed together.

There is also a question of how mutable parts should be,
and whether a `PartGroup` can appear as a part of another `PartGroup` for nested template instances or not.
It doesn't make much sense for the list of *DOM parts* associated with `PartGroup` to get mutated after
we've started committing things but there certainly is a room for adding or removing *DOM parts* based on new input or state.

If we made the relationship between *DOM parts* and `PartGroup` not dynamically mutable,
users of this API could still create a new `PartGroup` each time such a mutation would have needed instead.

### Batching Order

What order should the *DOM part group* commit each *DOM parts*' new values?
In the old proposal, the [tree order](https://dom.spec.whatwg.org/#concept-tree-order)
at the time of parsing the template element's content was an obvious choice.

This isn't possible in `Part`-only API because there isn't a single point in time when all *DOM parts* are created.
We could re-evaluate each time a new *DOM part* is added to a *DOM part group* but that would incur a high runtime cost
since it would likely require traversing all [node trees](https://dom.spec.whatwg.org/#concept-node-tree) referenced by each *DOM part*.
Dynamically evaluating at the time of committing pending changes doesn't work either
because some of the [nodes](https://dom.spec.whatwg.org/#concept-node) might not be
a part of the same [node tree](https://dom.spec.whatwg.org/#concept-node-tree) until some of the pending changes are committed.

The simplest choice is probably the order in which *DOM part* was inserted to a given *DOM part group*.
Although there could be multiple *DOM parts* which reference the same element in different parts of the array,
that doesn't necessarily pose an obvious issue other than a slight inefficiency in batching certain DOM operations.
Because the template engine is the one which creates these `Part` objects,
this is also probably not an issue in practice.
In any case, we can batch mutations per [element](https://dom.spec.whatwg.org/#concept-element)
like we do with [custom element reaction queue](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-reaction-queue) if necessary.

### Cloning Parts

Similarly, in [the old proposal](https://github.com/rniwa/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#3-proposal),
the [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element) was a natural source of template parts.
The browser engine can cache the result of parsing the [template content](https://html.spec.whatwg.org/multipage/scripting.html#template-contents)
and use that to efficiently generate template parts.

To achieve a similar efficiency with the Part-only API, we need a way to clone a Node subtree with Parts associated with a given PartGroup:

```webidl
partial interface Node {
    NodeWithParts cloneTree(optional CloneOptions options = {});
};

dictionary CloneOptions {
    boolean deep = true;
    Document? document;
    PartGroup? partGroup;
};

dictionary NodeWithParts {
    Node node;
    PartGroup? partGroup;
};
```

Here, we're proposing a slightly nicer API by combining [`importNode`](https://dom.spec.whatwg.org/#dom-document-importnode)
and [`cloneNode`](https://dom.spec.whatwg.org/#dom-node-clonenode)
and making the [cloning](https://dom.spec.whatwg.org/#concept-node-clone) deep by default.

There are some questions here as well.
What happens to the current values of *DOM parts*?
Do we allow *DOM parts* to have some non-initial values and do we clone those values as well?
If so, what do we do with `PropertyPart` / `CustomPart`?
