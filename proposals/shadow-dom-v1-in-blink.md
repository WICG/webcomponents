Shadow DOM v1 in Blink
====

Hayato Ito <hayato@google.com>

This document summarizes what *"Shadow DOM v1"* means and its status in Blink.

Last update: `<2015-10-14 Wed>`

What is Shadow DOM?
----

Shadow DOM is one of the pieces of Web Components. Numerous online resources about Web Components are available. I recommend http://webcomponents.org/, which is well-maintained.


What is Shadow DOM v1? Does *v* represents for *version*? I thought that Shadow DOM spec is *"Living Standard"*.
----

Shadow DOM spec should be considered as [Living Standard]. [HTML Standard] and [DOM Standard] have already adapted [Living Standard] model.

You could read `v1` as *version 1*, however, please don't take it seriously. We, browser vendors, need a good terminology which represents *something* on which all of us can agree to implement Shadow DOM.
`v1` is a convenient term in a discussion.

If you are uncomfortable with `v1`, you can think it as `p1`, priority 1. I am using `v1` label for an issue if the issue must be resolved asap so other browser vendors can start to implement Shadow DOM.
There is no extra meaning with `v1` other than that.

[Shadow DOM spec]: https://w3c.github.io/webcomponents/spec/shadow/
[Living Standard]: https://wiki.whatwg.org/wiki/FAQ#What_does_.22Living_Standard.22_mean.3F
[HTML Standard]: https://html.spec.whatwg.org/
[DOM Standard]: https://dom.spec.whatwg.org/

Relevant Links:

- [The resolution of the Web Components f2f meeting, April 2015](https://www.w3.org/wiki/Webapps/WebComponentsApril2015Meeting)
- [Shadow DOM v1 Open Issues](https://github.com/w3c/webcomponents/issues?q=is%3Aopen+label%3Av1+label%3Ashadow-dom)
- [The state of Web Components from Mozilla](https://hacks.mozilla.org/2015/06/the-state-of-web-components/)


What is Shadow DOM v2?
----

As you can imagine, there is no significant meaning for `v2` label. I am using `v2` label for a spec issue if the issue doesn't need to be resolved soon.

You can consider `v2` as "*fix it later*". `v2` is also a convenient term in the discussion because we are already using `v1`.
We can say something like: "Let's defer it to v2 since we can consider it later".

Now I'm focusing on solving all Shadow DOM v1 issues because it might block other vendors to implement Shadow DOM.


What's the status of Shadow DOM in Blink?
----

In short:

1. Shadow DOM `v0`: Supported. Blink shipped Shadow DOM in M35. Let me call what Blink is shipping now `v0` so we can distinguish it from `v1`. `v0` will be deprecated once Blink supports `v1`.
2. Shadow DOM `v1`: In development.
    - ["Intent to Implement: Shadow DOM v1"](https://groups.google.com/a/chromium.org/forum/#!msg/blink-dev/Ez2cuT0KmQo/eUpSsU-uAgAJ) thread in blink-dev


What's difference between v0 and v1?
----

TODO(hayato): This list is incomplete as of 2015-10-09. Update the list and add more links for details.


- Removed:
    - Element.createShadowRoot()
    - `<content>`, `<shadow>`
    - Multiple Shadow Roots
        - [Intent to Deprecate](TODO)
        - [Chromium Issue #489947](https://code.google.com/p/chromium/issues/detail?id=489947)
        - [CL](https://codereview.chromium.org/1159563012/)
    - Shadow piecing descendant combinator, `/deep/` and shadow pseudo elements, `::shadow`
        - [Intent to Deprecate](TODO)
        - [Chromium Issue #489954](https://code.google.com/p/chromium/issues/detail?id=489954)
        - [CL](https://codereview.chromium.org/1166833002/)

- Added:
    - attachShadow (<= createShadowRoot was renamed to)
    - Disallow attachShadow() for some elements.
        - [Spec Issue #102](https://github.com/w3c/webcomponents/issues/102)
    - Closed Shadow Trees
        - [Spec Issue #85](https://github.com/w3c/webcomponents/issues/85)
        - [Spec Issue #100](https://github.com/w3c/webcomponents/issues/100)
        - [Chromium Issue](https://code.google.com/p/chromium/issues/detail?id=459136)
    - Slots
        - [Spec Issue #95](https://github.com/w3c/webcomponents/issues/95)
        - [public-webapps: How about let's go with slots?](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0649.html)
    - NonDocumentTypeChildNode.assignedSlot
    - Slot.getAssignedNodes()
    - Event.deepPath (<= Event.path was renamed to)
        - [Intent to Implement and Ship: Event.deepPath](https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/8_x0OHYQdx0)

- On-going discussion which might affect both `v0` and `v1`

    - Cascading order for Shadow Trees
        - [www-style: [css-scoping] Shadow Cascading](https://lists.w3.org/Archives/Public/www-style/2015Jun/0118.html)
    - Events dispatching model. Only trusted events are subject to the event path trimming algorithm.
    - Event.scoped
        - [Spec Issue #107](https://github.com/w3c/webcomponents/issues/107)
        - [Spec Issue #61](https://github.com/w3c/webcomponents/issues/61)
    - The return type of getDistributedNodes() will change, from NodeList to sequence<Node>.
        - [Spec Issue 108](https://github.com/w3c/webcomponents/issues/108)


<a name="v0-deprecation"></a>Does Blink continue to support `v0`? You said `v0` will be deprecated. Do you have a schedule?
----

A tentative schedule to deprecate Shadow DOM v0:


1. [2015 Q3 (Done at M45)] Deprecate Multiple Shadow Roots

    - [Intent to Deprecate](https://groups.google.com/a/chromium.org/forum/#!msg/blink-dev/9qDsRePDALE/7c8kOkJfLgkJ)
    - [Chrome Status](https://www.chromestatus.com/features/4668884095336448)

2. [2015 Q3 (Done at M45)] Deprecate `/deep/` and `::shadow`

    - [Intent to Deprecate](https://groups.google.com/a/chromium.org/forum/#!msg/blink-dev/68qSZM5QMRQ/pT2YCqZSomAJ)
    - [Chrome Status](https://www.chromestatus.com/feature/6750456638341120)

3. [2016 Q1] Finish the implementation of Shadow DOM v1 (guarded by `ShadowDOMV1` runtime flag) so user can experiment v1 in Blink.

    - [Intent to Implement](https://groups.google.com/a/chromium.org/forum/#!msg/blink-dev/Ez2cuT0KmQo/eUpSsU-uAgAJ)

4. [2016 Q2] Ship Shadow DOM v1 in Blink

5. Wait for major libraries, such as Polymer, to switch to use Shadow DOM v1 and be shipped.

6. [2016 Q4 or later] Send an "Intent to Deprecate: Element.createShadowRoot()" to blink-dev.

    - TODO(hayato): Deprecate all v0 related APIs together?
        - e.g. Deprecate `event.path` at this timing?

7. [2017 or later] Send an "Intent to Remove: Shadow DOM v0" to blink-dev if we can feel it's ready to remove.



<a name="unified-distribution"></a> How `v0` and `v1` can interact each other in the transition period? It looks they can not be used at the same time in the same document.
---

In the transition period from `v0` to `v1`, it is highly expected that one document would happen to mix web components based on `v0` and web components based on `v1. Users might want to mix third-party libraries in their web pages.
To support such a situation, I've decided to support both, *v0* and *v1*, co-exist in the same document in Blink.

Because the Shadow DOM spec is inappropriate place to explain how *v0* and *v1* interact each other, let me explain its behavior, as an *unofficial spec*, here.

Disclaimer: This is a tentative plan. If I encounter a technical difficulty to support both in the same document, I might change the plan. In any cases, I'll do the best effort to continue to support *v0* in the transition time even after `v1` comes to Blink.


###Rule 1) A *V0* shadow tree, created by `createShadowRoot`, supports only an insertion point (`<content>`), but it doesn't support a slot.

###Rule 2) A *v1* shadow tree, created by `attachShadow`, supports only a slot (`<slot>`), but it doesn't support an insertion point.

What this means is:

- A `<slot>` element in *v0 shadow tree* never behave as a slot. That would behave as if it were a *HTMLUnknownElement*.
- A `<content>` element in *v1 shadow tree* never behave as an insertion point. That would behave as if it were a *HTMLUnknownElement*.

Example: `<slot>` is used in *v0* shadow tree (You shouldn't do that!):


```html
[document tree]
<div id=host1>
  <div id="a" slot="slotA">

  [shadow tree 1] // a child tree of document tree, created by host1.createShadowRoot()
  <shadow-root>
    <slot name="slotA">   // This doesn't work as intended. Don't use <slot> in v0 shadow tree.
    <content select="#a"> // This works as intended. #a is distributed to this insertion point.
```

Example: `<content>` is used in *v1* shadow tree. (You shouldn't do that!):


```html
[document tree]
<div id=host1>
  <div id="a" slot="slotA">

  [shadow tree 1]  // a child tree of document tree, created by host1.attachShadow(..)
  <shadow-root>
    <slot name="slotA">    // This works as intended. #a is assigned to this slot.
    <content select="#a">  // This doesn't work as intended. Don't use <content> in v1 shadow tree.
```

I hope this is a reasonable restriction for most users.
By introducing this simple restriction, we don't have to remember the order of precedence in selecting nodes if both `<slot>` and `<content>` are used in in the same shadow tree.


###Rule 3) A tree of trees supports a distribution across v0 and v1 shadow trees, called an *unified distribution*.

Let's explain what this means by examples.

Example): The parent tree is a *v0* shadow tree, and the child tree is a *v1* shadow tree.


```html
[document tree]
<div id=host1>
  <div id="a">


  [shadow tree 1]  // a child tree of document tree, created by host1.createShadowRoot()
  <shadow-root>
    <div id=host2>
      <content id="c" select="#a" slot="slotA">


      [shadow tree 2]  // a child tree of shadow tree 1, created by host2.attachShadow(..)
      <shadow-root>
        <slot id="s" name="slotA">
```

The distribution would be:

```js
c.getDistributedNodes == [a]  // As usual
c.assignedSlot == s   // content can be assigned to a slot. This won't be surprising.
// s.getDistributedNodes != [c]
s.getDistributedNodes == [a]   // If a <content> is assigned to a slot,  <content> would act like a *slot*.
a.getDestinationInsertionPoints == [c, s]  // A slot *can* appear in the getDestinationInsertionPoints. It would behave as if it were an insertion point.
```


Example): The parent tree is a *v1* shadow tree, and the child tree is a *v0* shadow tree.


```html
[document tree]
<div id=host1>
  <div id="a" slot="slotA">

  [shadow tree 1]  //  a child tree of document tree, created by host1.attachShadow(..)
  <shadow-root>
    <div id=host2>
      <slot id="s" slot="slotA">

      [shadow tree 2]  // a child tree of shadow tree 1, created by host2.createShadowRoot()
      <shadow-root>
        <content id="c" select="#a">
```

The distribution would be:

```js
a.assignedSlot == s
s.getDistributedNodes == [a]  // As usual
c.getDistributedNodes == [a]  // <content> will select a node from the distributed nodes of a slot, not a slot itself. In general, <content select="slot"> doesn't make sense in most scenes.
a.getDestinationInsertionPoints == [s, c]  // A node can be re-distributed through a slot.
```

I'm a Blink developer. What's the impact of v1 for our codebase?
----

- [ ] I'd like to remove [ElementShadow] and relevant classes someday. However, we can't remove it until we drop the support of multiple shadow roots from Blink.

      - Note that Blink just deprecated the multiple shadow roots. We are still supporting it.
      - I'm afraid that Blink will have painful period since we have to support both worlds for a while. I'm looking for the best approach which makes our codebase manageable and competitive.


- [ ] A [StyleResolver] can be simplified somehow hopefully, given that `/deep/` and `::shadow` are gone and the Cascading Order for Shadow Tress will be simplified.

      - There is an on-going effort to make Style Resolver more factored and get benefits from scopes style resolving.
      - Note that we have still `::content`. The situation mightn't change as I thought.


- [ ] I'm adding one more kind of ShadowRoot, called ClosedShadowRoot, as a different ShadowRoot than UA ShadowRoot.

      - I've renamed `{Author,UserAgent}ShadowRoot` to `{Open,Closed}ShadowRoot` in the [CL](https://codereview.chromium.org/935283002), however, it turned out that the name of `ClosedShadowRoot` caused a lot of confusion to our codebase. So, instead of batch renaming, I'll introduce the name of "closed" in a more incremental way so that `ClosedShadowRoot` and `UserAgentShadowRoot` can co-exist, with the different meanings, which doesn't upset the existing code.
      - See the [revert patch](https://codereview.chromium.org/1091473002/) for details.


[ElementShadow]: https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/core/dom/shadow/ElementShadow.h
[StyleResolver]: https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/core/css/style/StyleResolver.h
