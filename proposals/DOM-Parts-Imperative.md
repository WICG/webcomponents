# DOM Parts Imperative API

This proposal covers the imperative API for creating a DOM part.

## Proposal

A DOM part is represented by the `Part` interface and its sub interfaces.

```webidl
interface Part {
    attribute any value;
    readonly attribute Array<Part> parts;
    void commit();
};

interface NodePart : Part {
    constructor(Node node);
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
    readonly attribute Node? previousSibling;
    readonly attribute Node? nextSibling;
};
```

The `Part` has one property named "value" of
[_any_ type](https://heycam.github.io/webidl/#idl-any). It also has a readonly `parts` property that
contains any contained parts, if applicable.

When a new value is set or assigned to a DOM part, the change does not
immediately reflect back to the corresponding
[node](https://dom.spec.whatwg.org/#concept-node), its
[attributes](https://dom.spec.whatwg.org/#concept-attribute), or its
[properties](<(https://tc39.es/ecma262/#sec-object-type)>). Instead, the new
value is staged to be later committed in a batch. This batching reduces the
runtime overhead of constantly returning control back from browser's
implementation to JavaScript between each DOM mutation and allows browser
engine's to avoid or batch certain sanity checks and housekeeping tasks.

In the most basic level, this proposal consists of three DOM parts:

1. `NodePart` represents a single
   [node](https://dom.spec.whatwg.org/#concept-node).
1. `AttributePart` represents a single
   [attribute](https://dom.spec.whatwg.org/#concept-attribute).
1. `ChildNodePart` represents a sequence of
   [child](https://dom.spec.whatwg.org/#concept-tree-child)
   [nodes](https://dom.spec.whatwg.org/#concept-node) of a node which can be
   [replaced](https://dom.spec.whatwg.org/#concept-node-replace).

### Basic Examples

Suppose we had the following template in some HTML extension template languages
where `{name}` and `{email}` indicated locations of dynamic data insertion:

```html
<section>
  <h1 id="name">{name}</h1>
  Email: <a id="link" href="mailto:{email}">{email}</a>
</section>
```

And the application has produced the following HTML with the static content:

```html
<section>
  <h1 id="name"></h1>
  Email: <a id="link"></a>
</section>
```

Then the application can imperatively create a `ChildNodePart` for
[`h1` element](https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements)
and
[`a` element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
and an `AttributePart` for
[`a` element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
as follows:

```js
const name = staticContent.getElementById("name");
const link = staticContent.getElementById("link");
const namePart = new ChildNodePart(name);
const emailPart = new ChildNodePart(link);
const emailAttributePart = new AttributePart(link, "href");
```

Then assigning values as follows will update the DOM:

```js
namePart.value = "Ryosuke Niwa";
emailPart.value = "rniwa@webkit.org";
emailAttributePart.value = "mailto:rniwa@webkit.org";
namePart.commit();
emailPart.commit();
emailAttributePart.commit();
```

The resultant DOM will look like this:

```html
<section>
  <h1 id="name">Ryosuke Niwa</h1>
  Email: <a id="link" href="mailto:rniwa@webkit.org">rniwa@webkit.org</a>
</section>
```

## `DocumentPart`

A dynamic list of parts is maintained at the document or document fragment level that would allow fetching all parts.

```webidl
interface DocumentPart : Part {
}

partial interface Document {
  DocumentPart getPart();
}

partial interface DocumentFragment {
  DocumentPart getPart();
}
```

The list of parts would be cached initially on render, and then invalidated for
lazy recalculation for any new `Part` that was declaratively or imperatively
added to the `document`.

The `parts` array would be in DOM-order. The exact algorithm for how to keep the
`parts` array up to date with the `document` is up to the user-agent, but is invalidated anytime
the user-agent detects changes to the DOM that could invalidate the array.

## `ChildNodePart` `parts` array

Much like `DocumentPart`, any parts contained within a `ChildNodePart` are also contained within a
cached `parts` array.

### Open Cloning Questions

The precise specification of invalidation, caching, etc. is still yet to be described.

## Cloning Parts

Cloning parts along with the nodes they refer to is a major use case for DOM
parts. Cloning is supported for `DocumentPart` and `ChildNodePart`, which returns a `NodeWithParts`
object that contains a root node as well as a parts array with top-level parts.

```webidl
partial interface DocumentPart {
    NodeWithParts clone();
}

partial interface ChildNodePart {
    NodeWithParts clone();
}
```

### Open Cloning Questions

There are some edge cases that are worth thinking about, like whether un-committed values of parts
are cloned or whether invalid parts should be cloned.

## Partial Attribute Updates

Note in that above example,
[`href` attribute](https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-href)
had initially contained `mailto:` before `{email}` but we could not capture this
prefix in the attribute value because `AttributePart` could only set the whole
attribute value.

Instead of `AttributePart` having a single string `value`, it could optionally take an `Array` that
contains values that should be concatenated together. This allows updating individually parts of the
attribute without needing to serialize the entire string.

```js
const part = AttributePart(element, "href");
part.value = ["mailto: ", email];
```

This API may be strengthened further to optionally take in a `TemplateStringsArray` and variables,
which would allow the browser to determine which parts of the attribute were compile-time
constants. This could allow using tagged template literals to pass static content to the browser.

```js
const part = AttributePart(element, "href", {template: attribute`mailto: ${0}`});
part.value = [email];
```

## Sibling `ChildNodePart`s

Like partial attribute updates, when there are multiple points of interests
under a single [parent](https://dom.spec.whatwg.org/#concept-tree-parent)
[node](https://dom.spec.whatwg.org/#concept-node), and they're next to each
other, previous and next sibling does not adequately describe a specific location in the DOM when
other parts [insert](https://dom.spec.whatwg.org/#concept-node-insert) or
[remove](https://dom.spec.whatwg.org/#concept-node-remove)
[children](https://dom.spec.whatwg.org/#concept-tree-child).

### Option 1. Create Multiple `ChildNodePart`s Together

In this approach, `ChildNodePart` gets a new static function which creates a
list of `ChildNodePart`s which work together to set a value when the values are
to be committed:

```js
const [firstName, lastName] = ChildNodePart.create(element, null, null, [
  null,
  " ",
  null,
]);
```

- **Pros**: Simplicity.
- **Cons**: Coming up with a nice syntax to create a sequence of `ChildNodePart`
  and string can be tricky.

### Option 2. Introduce `ChildNodePartGroup`

In this approach, we group multiple `ChildNodePart`s together by creating an
explicit group:

```js
const firstName = new ChildNodePart();
const lastName = new ChildNodePart();
const group = ChildNodePartGroup(element, null, null);
group.append(firstName, " ", lastName);
```

This is morally equivalent to option 1 except there is an explicit grouping
step.

- **Pros**: Nicer syntax by the virtue of individual "partial" `ChildNodePart`s
  existence at the time of grouping. Code that sets new children to
  `ChildNodePart`s only needs to know about `ChildNodePart`.
- **Cons**: More objects / complexity. `ChildNodePart` will have two modes.

### Option 3. Introduce `PartialChildNodePart`

This creates `PartialChildNodePart` from `ChildNodePart`:

```js
const firstNamePartial = new PartialChildNodePart();
const lastNamePartial = new PartialChildNodePart();
const part = ChildNodePart(element, null, null);
part.values = [firstNamePartial, " ", lastNamePartial];
```

- **Pros**: Nicer syntax by the virtue of individual `PartialChildNodePart`s
  existence at the time of grouping.
- **Cons**: More objects / complexity. Code that uses a template has to deal
  with two different kinds of objects: `PartialChildNodePart` and
  `ChildNodePart`.

### Option 4. Allow `nextSibling` and `previousSibling` to point to another `ChildNodePart`

We would update `ChildNodPart` interface as follows and allow `previousSibling`
and `nextSibling` to point to another `ChildNodePart` as well as `Node`:

```webidl
interface ChildNodePart : Part {
    constructor(Node node, (Node or ChildNodePart)? previousSibling, (Node or ChildNodePart)? nextSibling);
    readonly attribute Node parentNode;
    readonly attribute (Node or ChildNodePart)? previousSibling;
    readonly attribute (Node or ChildNodePart)? nextSibling;
};
```

Then we can insert two consecutive `ChildNodePart`s by relating them in the
constructor as follows:

```js
const firstName = new ChildNodePart(element);
const lastName = new ChildNodePart(element, firstName);
```

Note that `lastName` takes `firstName` as the previous sibling but `firstName`
doesn't `lastName` as the next sibling (since `lastName` doesn't exist at that
point in time). This would mean that we'd have to do a bit of implicit updating
of previous/next sibling of other parts in the constructor.

An alternative is to add an explicit API to chain multiple parts togethers:

```js
const firstName = new ChildNodePart(element);
const lastName = new ChildNodePart(element);
ChildNodePart.chain(firstName, lastName);
```

- **Pros**: API simplicity. Only `ChildNodePart` is involved but construction
  isn't as awkward as option 1.
- **Cons**: "Chained" `ChildNodePart` must coordinate when applying mutations.

### Option 5. Throw an error if two `ChildNodePart`s overlap

Instead of worrying about coordination, the imperative API could throw an
`Error` if users constructed two `ChildNodePart`s that overlapped.

```js
const firstName = new ChildNodePart(element);
const lastName = new ChildNodePart(element); // throws an Error.
```

Like in option 4, new APIs like `chain` or an a `append` could be added that
make it easier to have repeated `ChildNodePart`s.

- **Pros**: API simplificity. Prevents nodes from getting into conflicting or
  confusing states.
- **Cons**: Parts need to be aware of one another.

## `ChildNodePart` After DOM Mutations

A `ChildNodePart` can be constructed with a `previousSibling` and/or
`nextSibling`. This raises the question of what happens if these nodes are
mutated, such as being removed from the DOM or added underneath a different
parent.

### Option 1. Part validity

It does not make sense to treat DOM parts as valid if the nodes in the DOM are
not in a state that is logical. So a new validity concept could be introduced
with the following constraints for `ChildNodePart`:

1. `previousSibling` and `nextSibling` do not share the same parent
1. Another `ChildNodePart` is overlapping, meaning it starts before
   `previousSibling` and ends between `previousSibling` and `nextSibling` or
   starts between `previousSibling` and `nextSibling` and ends after
   `nextSibling`.

If a `ChildNodePart` is invalid, `.value` is empty string and setting it does
nothing, and `.commit()` throws an Error.

For `NodePart` and `AttributePart`, validity could also be whether the related
`Node` was in a `document`, but it could also make sense to allow updates to
disconnected `Node`s.

### Option 2. Use an invisible markers after construction.

`ChildNodePart` could create an invisible marker immediately after
`previousSibling` and immediately before `nextSibling`, much like how `Range`
works. This comes with all the drawbacks or `Range`, but does have better
performance because they can only be added to via `ChildNodePart` APIs, and
always are scoped to a single `Node`'s children.

These invisible markers would not be `Node`s and so would be backwards
compatible. DOM mutations would follow shrinking `Range` semantics, meaning the
`ChildNodePart` would remove any `Node` that is removed in between the markers,
and would only add a `Node` if it is added in between the markers.

## `PropertyPart` and `CustomCallbackPart`

Adding the support to set a
[JavaScript property](https://tc39.es/ecma262/#sec-object-type) on, or invoking
the [setter](https://tc39.es/ecma262/#table-accessor-property-attributes) of, a
[DOM node](https://dom.spec.whatwg.org/#concept-node) poses an unique challenge
but it has been
[one of the most consistent feedback](https://github.com/w3c/webcomponents/issues/810).
A naive approach can reduce or eliminate the benefit of batching multiple DOM
mutations together since invoking JavaScript forces the browser engine to update
all its internal states to a consistent state prior to any script execution. On
the other hand, re-ordering so that all JavaScript related operations happen at
the end can cause a
[JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes)
to override [content attributes](https://dom.spec.whatwg.org/#concept-attribute)
which appear later in the markup, which would be a confusing behavior for users
of a template engine.

One way to solve this issue by delaying JavaScript execution until all DOM
mutations are done but interleaving
[custom element callback reactions](https://html.spec.whatwg.org/multipage/custom-elements.html#callback-reaction)
in-between setter calls. This ensures
[custom element callback reaction](https://html.spec.whatwg.org/multipage/custom-elements.html#callback-reaction)
for [attribute changes](https://dom.spec.whatwg.org/#handle-attribute-changes)
and setter calls occur in the order they are scheduled.

To achieve this observable behavior, when a DOM part of this type `PropertyPart`
appears on an [element](https://dom.spec.whatwg.org/#concept-element), we insert
a new kind of an item into the
[element](https://dom.spec.whatwg.org/#concept-element)'s
[custom element reaction queue](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-reaction-queue).
This new kind of item, let us call it **property reaction**, is simply an
arbitrary entry point back to the code which invokes the
[JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes)
unlike other items in the queue which involves some predefined method passed to
[`customElements.define`](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define).

Consider two `AttributePart`s and a `PropertyPart` which all work an
[element](https://dom.spec.whatwg.org/#concept-element) `A`, another
`AttributePart` and `PropertyPart` for different
[element](https://dom.spec.whatwg.org/#concept-element) `B`, and a sequence of
updates as shown below where each A* and B* are `AttributePart`s and
`PropertyPart`s for respective elements:

```js
bPropertyPart.value = "foo";
aAttributePart1.value = "foo";
bAttributePart.value = "foo";
aPropertyPart.value = "foo";
aAttributePart2.value = "foo";
```

Recall that these assignments to DOM parts simply stage values to be set when
the groups later commit changes. It has a queue unique to each element of the
"staged" DOM parts with pending mutations, in this case:
`[aAttributePart1, aPropertyPart1, aAttributePart2]` for `A` and
`[bPropertyPart, bAttributePart]` for `B`. Suppose `A` appears before `B` in the
group all these DOM parts belong to. Then as the browser engine makes DOM
mutations for `aAttributePart1` and `aAttributePart2` on `A`, it also schedules
a _property reaction_ for `aPropertyPart` between the two. It would then
schedule a _property reaction_ for `bPropertyPart` then makes DOM mutation for
`bAttributePart`.

If `A` is a
[custom element](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element),
then the following sequence of events will take place:

- `attributeChangedCallback` for `aAttributePart1` gets invoked.
- _Property reaction_ and therefore the corresponding
  [JavaScript setter](https://tc39.es/ecma262/#table-accessor-property-attributes)
  for `aPropertyPart` gets invoked.
- `attributeChangedCallback` for the attribute `aAttributePart` marks gets
  invoked.

The _property reaction_ of `PropertyPart` simply invokes
[`Set(O, P, V, Throw)`](https://tc39.es/ecma262/#sec-set-o-p-v-throw) on `A`.
With this in mind, `PropertyPart`'s interface could simply be:

```webidl
interface PropertyPart : Part {
    constructor(Node node, DOMString propertyName);
    readonly attribute propertyName;
}
```

Since the mechanism of invoking a _property reaction_ is generic enough to
execute arbitrary scripts, not just
[`Set(O, P, V, Throw)`](https://tc39.es/ecma262/#sec-set-o-p-v-throw), we could
generalize it to support arbitrary code execution like this:

```webidl
callback CustomPartCallback = undefined (Node node, CustomPart part);
interface CustomPart : Part {
    constructor(Node node, CustomPartCallback callback);
}
```
