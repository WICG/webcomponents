# DOM Parts Imperative API

This proposal covers the imperative API for creating a DOM part.

## Proposal

A DOM part is represented by the `Part` interface and its sub interfaces.

```webidl
interface Part {
    attribute any value;
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
[_any_ type](https://heycam.github.io/webidl/#idl-any).

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

## Part Groups

DOM parts need grouping and ownership to provide batching and to enable parts
created declaratively to be retrieved and updated by JavaScript.

### Option 1. `PartGroup`

One option is to make the concept of DOM part group a real DOM
[interface](https://heycam.github.io/webidl/#idl-interfaces):

```webidl
interface PartGroup {
    constructor(sequence<Part> parts);
    readonly attribute FrozenArray<Part> parts;
    void commit();
}
```

Note that if we allow a single `Part` to belong to multiple `PartGroup`s, the
first `PartGroup` which commits the changes would apply the mutations. In
effect, this allows
non-[partitioned](https://en.wikipedia.org/wiki/Partition_of_a_set) grouping of
`Part` objects to be committed together.

There is also a question of how mutable parts should be, and whether a
`PartGroup` can appear as a part of another `PartGroup` for nested template
instances or not. It doesn't make much sense for the list of _DOM parts_
associated with `PartGroup` to get mutated after we've started committing things
but there certainly is a room for adding or removing _DOM parts_ based on new
input or state.

If we made the relationship between DOM parts and `PartGroup` not dynamically
mutable, users of this API could still create a new `PartGroup` each time such a
mutation would have needed instead.

The `parts` order would be the order in which DOM part was inserted to the
`PartGroup`. Although there could be multiple DOM parts which reference the same
element in different parts of the array, that doesn't necessarily pose an
obvious issue other than a slight inefficiency in batching certain DOM
operations.

### Option 2. `DocumentPartGroup`

A dynamic list of parts could be maintained at the `document` (and document
fragment) level that would allow fetching all parts.

```webidl
interface DocumentPartGroup {
  readonly attribute Array<Part> parts;
  void commit();
}

partial interface Document {
  readonly attribute DocumentPartGroup documentPart;
}
```

The list of parts would be cached initially on render, and then invalidated for
lazy recalculation for any new `Part` that was declaratively or imperatively
added to the `document`.

The `parts` array would be in DOM-order. The exact algorithm for how to keep the
`parts` array up to date with the `document` is an open question.

### Option 3. `ChildNodePart` is a `PartGroup`

To make `DocumentPartGroup` more performant and to provide better structure to
`Part` relationships for a more optimal DOM walk, `ChildNodePart` could itself
be a `PartGroup`, and would contain any `Part` objects that were nested inside
its range, and child `parts` would not be part of any parent `ChildNodePart` or
`DocumentPartGroup`.

```webidl
interface ChildNodePart {
  readonly attribute Array<Part> parts;
  void commit();
}
```

The `parts` array would be in DOM-order. The exact algorithm for how to keep the
`parts` array up to date with the DOM subtree rooted by the `ChildNodePart` is
an open question.

## Cloning Parts

Cloning parts along with the nodes they refer to is a major use case for DOM
parts.

### Option 1: `cloneWithParts`

One option would to add a new API to `Node`:

```webidl
partial interface Node {
    NodeWithParts cloneWithParts(optional CloneOptions options = {});
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

Here, we're proposing a slightly nicer API by combining
[`importNode`](https://dom.spec.whatwg.org/#dom-document-importnode) and
[`cloneNode`](https://dom.spec.whatwg.org/#dom-node-clonenode) and making the
[cloning](https://dom.spec.whatwg.org/#concept-node-clone) deep by default.

### Option 2: `cloneWithParts` on `DocumentPart` and `ChildNodePart`

Since `DocumentPart` and `ChildNodePart` both are rooted at a specific node, the
clone semantics are clearer:

```webidl
partial interface DocumentPart {
    NodeWithParts clone();
}

partial interface ChildNodePart {
    NodeWithParts clone();
}
```

### Other Cloning Questions

There are some questions here as well. What happens to the current values of DOM
parts? Do we allow DOM parts to have some non-initial values and do we clone
those values as well? If so, what do we do with proposed extensions like
`PropertyPart` / `CustomPart`?

## Partial Attribute Updates

Note in that above example,
[`href` attribute](https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-href)
had initially contained `mailto:` before `{email}` but we could not capture this
prefix in the attribute value because `AttributePart` could only set the whole
attribute value.

There are a few options for how to support the use case of updating attributes
with embedded static content such as `mailto:`

### Option 1. Create Multiple `AttributePart`s Together

In this approach, `AttributePart` gets a new static function which creates a
list of `AttributePart`s which work together to set a value when the values are
to be committed:

```js
const [firstName, lastName] = AttributePart.create(element, "title", null, [
  null,
  " ",
  null,
]);
// Syntax to be improved. Here, a new AttributePart is created between each string.
```

- **Pros**: Simplicity.
- **Cons**: Coming up with a nice syntax to create a sequence of AttributePart
  and string can be tricky.

### Option 2. Introduce `AttributePartGroup`

In this approach, we group multiple `AttributePart`s together by creating an
explicit group:

```js
const firstName = new AttributePart();
const lastName = new AttributePart();
const group = AttributePartGroup(element, "title");
group.append(firstName, " ", lastName);
```

This is morally equivalent to option 1 except there is an explicit grouping
step.

- **Pros**: Nicer syntax by the virtue of individual "partial" `AttributePart`'s
  existence at the time of grouping. Code that assigns values to `AttributePart`
  only needs to know about `AttributePart`
- **Cons**: More objects / complexity. `AttributePart` will have two modes.

### Option 3. Introduce `PartialAttributePart`

Unlike option 2, this creates `PartialAttributePart`s from `AttributePart`,
meaning that `AttributePart` in option 3 plays the role of `AttributePartGroup`
in option 2:

```js
const firstNamePartial = new PartialAttributePart();
const lastNamePartial = new PartialAttributePart();
const part = AttributePart(element, "title");
part.values = [firstNamePartial, " ", lastNamePartial];
```

- **Pros**: Nicer syntax by the virtue of individual `PartialAttributePart`'s
  existence at the time of grouping. `AttributePart` just knows one thing to do:
  to set the whole content attribute value.
- **Cons**: More objects / complexity. Code that uses a template has to deal
  with two different kinds of objects: `PartialAttributePart` and
  `AttributePart`.

### Option 4. Support arbitrary JavaScript objects

One way of punting is to support arbitrary JavaScript objects as `value` that
conform to some interface. This interface could be as simple as `toString()`, or
could use `Symbol` to determine how to populate attributes. This would allow
code that wanted to represent partial attributes, but would maintain the
property that parts represent nodes or groupings of nodes.

```js
class TitleAttributeValue {
  constructor() {
    this.firstName = "";
    this.lastName = "";
  }

  toString() {
    return `${this.firstName} ${this.lastName}`;
  }
}

const part = AttributePart(element, "title");
part.value = new TitleAttributeValue();
part.value.firstName = "Ryosuke";
part.value.lastName = "Niwa";
```

- **Pros** No need for new `PartialAttributePart` or `AttributePart`
  coordination. Does not block a future API object that represents partial
  attributes.
- **Cons** Need a way to represent partial attributes that are declaratively
  defined.

## Sibling `ChildNodePart`s

Like partial attribute updates, when there are multiple points of interests
under a single [parent](https://dom.spec.whatwg.org/#concept-tree-parent)
[node](https://dom.spec.whatwg.org/#concept-node), and they're next to each
other, index does not adequately describe a specific location in the DOM when
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
