# Imperative API for Node Distribution in Shadow DOM

There are three proposed approaches to the problem depending on whether we want to natively support redistribution or not.

To recap, redistribution of a node (N_1) happens when it's distributed to an insertion point (I_1) inside a shadow root (S_1), and I_1's parent also has a shadow root which contains an insertion point which ends picking up N_1. e.g. the original tree may look like:
```
(host of S_1) - S_1
  + N_1         + (host of S_2) - S_2
                   + I_1           + I_2
```
Here, (host of S_1) has N_1 as a child, and (host of S_2) is a child of S_1 and has I_1 as a child. S_2 has I_2 as a child. The composed tree, then, may look like:
```
(host of S_1)
 + (host of S_2)
   + I_2
     + N_1
```

We assume this IDL as the basis for the various proposals:

```webidl
partial interface Element {
  ShadowRoot createShadowRoot(ShadowRootInit options);
};
dictionary ShadowRootInit {
  require ShadowRootMode mode;
};
enum ShadowRootMode { "open", "closed" };
```


## 1. Redistribution is implemented by authors

```webidl
interface HTMLContentElement : HTMLElement {
  void insertAt(Node nodeToDistribute, long index);
  void remove(Node distributedNode);
  readonly sequence<Node> distributedNodes;
  attribute EventHandler ondistributionchanged;
};
```

- `insertAt()` - Inserts `nodeToDistribute` to the list of the distributed nodes at `index`. It throws if `nodeToDistribute` is not a descendent (or a direct child if wanted to keep this constraint) of the shadow host of the ancestor shadow root of `content` or if `index` is larger than the length of `distributedNodes`.
- `remove()` - Remove `distributedNode` from the list of distributed nodes. Throws if `distributedNodes` doesn't contain this node.
- `distributedNodes` - Returns an array of nodes that are distributed into this insertion point in the order they appear.

In addition, `content` fires a synchronous `distributionchanged` event when `distributedNodes` changes (in response to calls to `insertAt()` and `remove()`).

In order to avoid having to inspect `distributedNodes` component authors could require component users to explicitly list the `<content>` elements so component authors only have to distribute the `<content>` elements themselves to the right location and therefore never have to look at their `distributedNodes`.

### Pros

- Very simple / very primitive looking.
- Defers the exact mechanism/algorithm of re-distributions to component authors.
- We can support distributing any descendent, not just direct children, to any insertion points. This was not possible with `<content select>` especially with the presence of multiple generations of shadow DOM due to perfomance problems.
  - Allows use cases such as calculating a grouping of child nodes and generating a <content> tag per group, or even generating a <content> tag per child to perform decoration. See [Justin Fagnani's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0325.html)
  - See table chart example below
- Allows distributed nodes to be re-ordered (`<content select>` doesn't allow this).

#### Table Chart
Consider table-chart component which coverts a table element into a chart with each column represented as a line graph in the chart. The user of this component will wrap a regular table element with table-chart element to construct a shadow DOM:

```html
<table-chart>
 <table>
   ...
     <td data-value="253" data-delta=5>253 ± 5</td>
   ...
 </table>
</table-chart>
```

For people who like is attribute on custom elements, pretend it's
```html
 <table is=table-chart>
   ...
     <td data-value="253" data-delta=5>253 ± 5</td>
   ...
 </table>
```

### Cons

- Each component needs to manually implement redistribution by recursively traversing through `distributedNodes` of `content` elements inside `distributedNodes` of the `content` element if it didn't want to re-distribute `content` elements as-is. This is particularly challenging because you need to listen to `distributionchanged` event on every such `content` element. We might need something aking to MutationObserver's `subtree` option to monitor this if we're going this route.
- It seems hard to support redistribution natively in v2.

## 2. Redistribution is implemented by UAs

In this model, the browser is responsible for taking care of redistribution. We would expose a `distribute` callback which gets invoked with an ordered list of nodes that could be distributed (because they're direct children of the host) or redistributed. (Conceptually, you could think of it as a depth first traversal of `distributedNodes` of every `content` element child (as in proposal 1) of the host coupled with all other children.) Because this list contains every candidate for redistribution, it's impractical performance-wise to include every descendent node especially if we wanted to do synchronous updates so we're back to supporting only direct children for distribution.

```webidl
callback DistributionCallback = void (sequence<(Text or Element)>);
dictionary ShadowRootInit {
  require ShadowRootMode mode;
  require DistributionCallback distribute;
};
partial interface ShadowRoot {
  void distribute(); // invoke the callback, recursively if there's nesting
};
interface HTMLContentElement : HTMLElement {
  void add((Text or Element) node);
};
```

We update the `ShadowRootInit` dictionary to include the `distribute` callback. We add a method to `ShadowRoot` to initiate the (re)distribution process. And we add a method to `content` named `add()`. Only `add()` is needed in this proposal because all candidates are distributed each time. So we can clear distributed nodes from every insertion point in the shadow DOM. (Leaving them doesn't make sense because some of the nodes that have been distributed in the past may no longer be available).

Here is an example of how this could be used to implement `<content select>` without dynamic updates:
```js
var shadow = host.createShadowRoot({
  mode: "closed",
  distribute: (distributionList) => {
    var insertionList = shadow.querySelector("content")
    for(var i = 0; i < distributionList.length; i++) {
      for(var ii = 0; ii < insertionList.length; ii++) {
        var select = insertionList[ii].getAttribute("select")
        if(select != null && distributionList[i].matches(select)) {
          insertionList[ii].add(distrubtionList[i])
        } else if(select == null) {
          insertionList[ii].add(distrubtionList[i])
        }
      }
    }
  }
})
shadow.distribute();
```

### Pros
- Components don't have to implement complicated redistribution algorithms themselves.
- Allows distributed nodes to be re-ordered (`<content select>` doesn't allow this).

### Cons
- Redistribution algorithm is not as simple
- At a slightly higher abstraction level
- If we wanted to allow non-direct child descendent (e.g. grand child node) of the host to be distributed, then we'd also need O(m) algorithm where m is the number of under the host element.

## 3. UA Callbacks on Every Distribution Candidate

Yet another approach is for UA to invoke the callback on every distribution candidate (see [Steve Orvell's post ](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0342.html)).

In this model, we have a callback that gets invokved by UA on each distribution candidate per insertion point that returns true if a node should be distributed to a given insertion point as follows:
```js
var shadow = host.createShadowRoot({
  // called synchronously for each node *added* to shadow's distribution pool
  // called sequentially for each content in shadow until `true` is returned.
  shouldDistributeNodeToInsertionPoint: function(node, content) {
    // to implement catch-all
    return true;
    // to implement <content select="...">
    // return node.matches(content.getAttribute('select'));
    // to implement <content slot="...">
    // return node.getAttribute('slot') === content.getAttribute('slot');
  }
});
```

### Pros
- The callback can be synchronous-ish because it acts only on a specific node when possible. i.e. UA can optimize to only invoke on necessary combinations of distirubiton candidates and insertion points.
- Can implement either the currently spec'd `select` mechanism or the proposed `slot` mechanism
- Can easily evolve to support distribution to isolated roots by using a pure function that gets read only node 'proxies' as arguments.

### Cons
- Cannot re-order the distributed nodes.
- Cannot distribute non-direct child descendents.

# API for Triggering Distribution

As explained in [Steve's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0357.html), it's desirable for custom elements to provide the same consistency guarantee as builtin elements. Currently spec'ed `<content select>` attribute supports this use case since UA takes care of the distribution all on its own.

Let's say we want to be able to create an element `<x-foo>` that acts like other dom elements. This element uses Shadow DOM and distribution to encapsulate its details.

Let's imagine a 3rd party user author that uses `<div>` and `<x-foo>`. The author knows to call `div.appendChild(element)` and then immediately ask `div.offsetHeight` and know that this height includes whatever the added element should contribute to the div's height. The author expects to be able to do this with the `<x-foo>` element also since it is just another element from the author's perspective.

How can we, the author of `<x-foo>`, craft my element such that I don't violate the 3rd party authors's expectations?

## 1. Keep the Current Timing

One approach is to keep the current timing, which is to say it's undefined so UA must update the distribution as needed. In many implementations this is when the computed style of an element is resolved or when an event fires.

### Pros
- Doesn't require any spec changes
- Provides consistent distribution state to user code

### Cons
- No interoperability

## 2. Add a New Children Changed Lifecycle Callback to Custom Elements

Another apporach is to add a new lifecycle callback that gets triggered when a shadow host's direct child is added, removed, or modified. Coupled with a synchrnous event that gets dispatched on a content element when the distribution changes, this allows custom element code to update its shadow DOM's distribution before other user code sees it.

### Pros
- Provides consistent distribution state to user code
- Interoperable

### Cons
- It could be as messy as old mutation events
- Might be still too expensive to use with the second approach which requires collecting every distribution candidate.

## 3. Introduce "Nanotask" Mutation Observers

Introduce a variant of mutation observers where the callback is invoked after each DOM method that mutates returns.

### Pros
- Provides consistent distribution state to user code
- Interoperable
- Simpler and more primitive
- Not tied to custom elements, it's just more fine-grained observers without the flaws of mutation events

### Cons
- It could be as messy as old mutation events
- Might be still too expensive to use with the second approach which requires collecting every distribution candidate.

## 4. Run Distribution Callback in a Separate Scripting Context or as Pure Function

Yet another approach is to decouple the timing from the observability by making callback execution not be observable. This can be accomplished by either creating a separate scripting context just for running distribution callbacks (similar to Houdini [ideas](https://wiki.css-houdini.org/explaining-css-layout#layout)), or some sort of not-yet-invented [pure function](http://en.wikipedia.org/wiki/Pure_function) ECMAScript primitive.

### Pros
- Provides consistent distribution state to user code
- Interoperable

### Cons
- Both separate scripting context and pure function ideas need much more thorough examination and may take years to get right

## 5. Browser-built "Fastdom" Callback

This is a combination of synchronous ("Nanotask") timing and Mutation Observer timing, where the user has to select the timing they wish. Effectively, introduce a `window.requestAmazingWriteTime(callback)` (name intentionally terrible) function. Inside `callback`, all DOM operations that would previously be synchronously updating layout will return inaccurate results (throw?), and DOM operations with "Nanotasks" will run these tasks at the microtask checkpoint, which occurs immediately after the callback exits. This is conceptually similar to [fastdom](https://github.com/wilsonpage/fastdom), except built into the browser.

Outside of this callback, the distribution API runs at "Nanotask" timing.

For example:

```js

function makeDOM(parent) {
  for (var i = 0; i < 1000; ++i) {
    parent.appendChild(document.createElement('mah-dom'));
    console.log(parent.offsetHeight);
  }
}

// slow: runs distribution callback 1000 times.
// accurate: logs correct height for each time.
makeDOM(document.body);

// fast: runs distribution callback 1 time.
// wrong: logs the same height (or throws) 1000 times.
requestAmazingWriteTime(() => {
   makeDOM(document.body);
});
```

### Pros
- Provides consistent distribution state for users who don't care about performance
- Provides best distribution timing for performance-conscious users
- Interoprerable

### Cons
- Defining effects of `requestAmazingWriteTime` on the entire DOM API seems arduous and would be difficult to specify interoperably.


## 6. Not a Problem for v1

At least the distribution API proposals 1/2 have some way forward where triggering can be introduced later and therefore this might not be a problem we want to address for v1.
