# Imperative API for Node Distribution in Shadow DOM

There are two approaches to the problem depending on whether we want to natively support redistribution or not.

To recap, a redistribution of a node (N_1) happens when it's distributed to an insertion point (I_1) inside a shadow root (S_1), and I_1's parent also has a shadow root which contains an insertion point which ends picking up N_1. e.g. the original tree may look like:
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


## 1. Redistribution is implemented by authors

In this model, we can add `insertAt` and `remove` on `content` element and expose `distributedNodes` defined as follows:
- `insertAt(Node nodeToDistribute, long index)` - Inserts `nodeToDistribute` to the list of the distributed nodes at `index`. It throws if `nodeToDistribute` is not a descendent (or a direct child if wanted to keep this constraint) of the shadow host of the ancestor shadow root of `containt` or if `index` is larger than the length of `distributedNodes`.
- `remove(Node distributedNode)` - Remove `distributedNode` from the list distributed nodes. Throws if `distributedNodes` doesn't contain this node.
- `distributedNodes` - Returns an array of nodes that are distributed into this insertion point in the order they appear.

In addition, `content` fires a synchrnous `distributionchanged` event when `distributedNodes` changes (in response to calls to `insertAt` or `remove`). 

### Pros

- Very simple / very primitive looking.
- Defers the exact mechanism/algorithm of re-distributions to component authors.
- We can support distributing any descendent, not just direct children, to any insertion points. This was not possible with `select` attribute especially with the presence of multiple generations of shadow DOM due to perfomance problems.
  - Allows use cases such as calculating a grouping of child nodes and generating a <content> tag per group, or even generating a <content> tag per child to perform decoration. See [Justin Fagnani's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0325.html)
  - See table chart example below
- Allows distributed nodes to be re-ordered (`select` doesn't allow this).

#### Table Chart
Consider table-chart component which coverts a table element into a chart with each column represented as a line graph in the chart. The user of this component will wrap a regular table element with table-chart element to construct a shadow DOM:

```html
<table-chart>
 <table>
   ...
     <td data-value=â€œ253â€ data-delta=5>253 Â± 5</td>
   ...
 </table>
</table-chart>
```

For people who like is attribute on custom elements, pretend it's
```html
 <table is=table-chart>
   ...
     <td data-value=â€œ253â€ data-delta=5>253 Â± 5</td>
   ...
 </table>
```

### Cons

- Each component needs to manually implement re-distributions by recursively traversing through `distributedNodes` of `content` elements inside `distributedNodes` of the `content` element if it didn't want to re-distribute everything. This is particularly challenging because you need to listen to `distributionchanged` event on every such `content` element. We might need something aking to MutationObserver's `subtree` option to monitor this if we're going this route.
- It seems hard to support re-distribution natively in v2.

## 2. Redistribution is implemented by UAs

In this model, the browser is responsible for taking care of redistributions. Namely, we would like to expose `distributionPool` on the shadow root which contains the ordered list of nodes that could be distributed (because they're direct children of the host) or re-distributed. Conceptually, you could think of it as a depth first traversal of `distributedNodes` of every `content` element.  Because this list contains every candidate for (re)distribution, it's impractical to include every descendent node especially if we wanted to do synchronous updates so we're back to supporting only direct children for distribution.

In this proposal, we add a new callback `distributeCallback(NodeList distributionPool)` as an arguemnt (probably inside a dictionary) to `createShadowRoot`. e.g.
```js
var shadowRoot = element.createShadowRoot({
  distributedCallback: function (distributionPool) {
    ... // code to distribute nodes
  }
});
```

Unfortunately, we can't really use `insertAt` and `remove` in model because `distributionPool` maybe changed under the foot by (outer) insertion points in the light DOM if this shadow root to attached to a host inside another shadow DOM unless we manually listen to `distributionchanged` event on every `content` (which may recursively appear in `distributedNodes` of those `content`).

One way to work around this problem is let UA also propagate changes to `distributionPool` to each nested shadow DOM. That is, when `distributionPool` of a shadow root gets modified due to changes to `distributionPool`s of direct children (of the shadow host) that are `content` elements themselves, UA will automatically invoke `distributedCallback` to trigger a distribution.

We also expose `distribute()` on `ShadowRoot` to allow arbitrary execution (e.g. when its internal state changes) of this distribution propagation mechanism. Components will use this function to listen to changes in DOM.

We could also trigger this propagation mechanism at the end of micro task (via MutationObserver) when direct children of a shadow host is mutated.

In terms of actual distribution, we only need to expose `add(Node)` on `content` element. Because all candidates are distributed each time, we can clear distributed nodes from every insertion point in the shadow DOM. (Leaving them in tact doesn't make sense because some of the nodes that have been distributed in the past may no longer be available).

There is an alternative approach to add something like `done()` or `redistribute` to specifically trigger redistribution but some authors may forget to make this extra function call because it's not required in normal cases.

We could go a step further and also provide the list of insertion points as follows (see [Anne's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0294.html):
```js
var shadow = host.createShadowRoot({
  mode: "closed",
  distribute: (distributionList, insertionList) => {
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
host.shadowRoot.distribute();
```

In summary, we make the following IDL changes (see [Anne's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0294.html):
```js
callback DistributionCallback = void (sequence<(Text or Element)>, sequence<HTMLContentElement>);
enum ShadowRootMode { "open", "closed" };
dictionary ShadowRootInit {
  require ShadowRootMode mode;
  require DistributionCallback distribute;
};
partial interface Element {
  ShadowRoot createShadowRoot(ShadowRootInit options);
};
partial interface ShadowRoot {
  void distribute(); // invoke the callback, recursively if there's nesting
};
interface HTMLContentElement : HTMLElement {
  void add((Text or Element) node);
};
```

### Pros
- Components don't have to implement complicated redistribution algorithms themselves.
- Allows distributed nodes to be re-ordered (`select` doesn't allow this).

### Cons
- Redistribution algorithm is not simple
- At a slightly higher abstraction level
- Computing insertionList is expensive because we'd have to either (where n is the number of nodes in the shadow DOM):
  - Maintain an ordered list of insertion points, which results in O(n) algorithm to run whenever a content element is inserted or removed.
  - Lazily compute the ordered list of insertion points when `distribute` callback is about to get called in O(n).
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

## Extention to Custom Elements for Consistency

As explained in [Steve's post](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0357.html), it's desriable for custom elements to provide the same consistency guarantee as builtin elements. Currently spec'ed `select` attribute supports this use case since UA takes care of the distribution all on its own.

Let's say we want to be able to create an element <x-foo> that acts like other dom elements. This element uses Shadow DOM and distribution to encapsulate its details.

Let's imagine a 3rd party user author that uses <div> and <x-foo>. The author knows to call div.appendChild(element) and then immediately ask div.offsetHeight and know that this height includes whatever the added element should contribute to the div's height. The author expects to be able to do this with the <x-foo> element also since it is just another element from the author's perspective.

How can we, the author of <x-foo>, craft my element such that I don't violate the 3rd party authors's expectations?

### 1. Keep the Current Timing

One approach is to keep the current timing, which is to say it's undefined so UA must update the distribution as needed. In many implementations this is when the computed style of an element is resolved or when an event fires.

#### Pros
- Doesn't require any spec changes
- Provides consistent distribution state to user code

#### Cons
- No interoperability

### 2. Add a New Children Changed Lifecycle Callback to Custom Elements

Another apporach is to add a new lifecycle callback that gets triggered when a shadow host's direct child is added, removed, or modified. Coupled with a synchrnous event that gets dispatched on a content element when the distribution changes, this allows custom element code to update its shadow DOM's distribution before other user code sees it.

#### Pros
- Provides consistent distribution state to user code
- Interoperable

#### Cons
- It coule be as messy as old mutation events
- Might be still too expensive to use with the second approach which requires collecting every distribution candidate.
