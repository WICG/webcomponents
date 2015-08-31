Shadow DOM v1 in Blink
====

Hayato Ito <hayato@google.com>

This document attempts to summarize what *"Shadow DOM v1"* means for Blink. The document will be updated as needed to reflect the latest status.


What is Shadow DOM v1? Does *v* represents for *version*? I thought that Shadow DOM spec is *"Living Standard"*.
----

Shadow DOM spec should be considered as [Living Standard], as [HTML] spec and [DOM] spec have already adapted [Living Standard] model. That hasn't changed.

Although you could read `v1` as *version 1*, please don't take it seriously. We, browser vendors, need a good terminology which represents *something* that all of us can agree to implement.
`v1` is a convenient term for that.

If you are uncomfortable for a term of `v1`, you can think it as `p1`, priority 1. Actually, I am using a label of `v1` when I label an issue which must be resolved asap so that other browser vendors can agree and start to implement Shadow DOM. There is no extra meaning.


[Living Standard]: https://wiki.whatwg.org/wiki/FAQ#What_does_.22Living_Standard.22_mean.3F
[HTML]: https://html.spec.whatwg.org/
[DOM]: https://dom.spec.whatwg.org/

Relevant Links:

- [The resolution of the Web Components f2f meeting, April 2015](https://www.w3.org/wiki/Webapps/WebComponentsApril2015Meeting)
- [Shadow DOM v1 Open Issues](https://github.com/w3c/webcomponents/issues?q=is%3Aopen+label%3Av1+label%3Ashadow-dom)
- [The state of Web Components from Mozilla](https://hacks.mozilla.org/2015/06/the-state-of-web-components/)


What is Shadow DOM v2?
----

There is no significant meaning for a label of `v2`. I am using a label of `v2` in the issue tracker if we don't think an issue is a high priority issue.

You can take `v2` as "*fix it later*". `v2` is a convenient term for the discussion, give that we are using `v1`. We can say "Let's defer it to v2 since we can consider it later".

Now I'm focusing on solving all Shadow DOM v1 issues because it might block other vendors to implement Shadow DOM. All other issues are labeled with `v2`.


Okay, so what big changes are coming to the Shadow DOM spec for v1?
----

As of now, I think the followings are relatively big changes:

Checked check box means "Done".

- [X] Closed Shadow Trees

      - [x] [Spec Issue #85](https://github.com/w3c/webcomponents/issues/85)
      - [X] [Spec Issue #100](https://github.com/w3c/webcomponents/issues/100)

- [X] Slots Proposal

      - [Spec Proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Slots-Proposal.md)
      - [Spec Issue #95](https://github.com/w3c/webcomponents/issues/95)
      - [public-webapps: How about let's go with slots?](https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0649.html)

- [ ] Cascading order for Shadow Trees

      - There is an on-going discussion: [www-style: [css-scoping] Shadow Cascading](https://lists.w3.org/Archives/Public/www-style/2015Jun/0118.html)

What changes are coming to Blink for v1?
----


- [x] Deprecate multiple shadow roots

      - [CL](https://codereview.chromium.org/1159563012/)

- [x] Deprecate shadow-piecing descendant combinators, `/deep/`.

      - [CL](https://codereview.chromium.org/1166833002/)

- [x] Deprecate shadow-pseudo elements, `::shadow`

      - [CL](https://codereview.chromium.org/1166833002/)

- [ ] event.deepPath

      - [Intent to Implement and Ship: Event.deepPath](https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/8_x0OHYQdx0)

- [ ] The return type of getDistributedNodes() will change, from NodeList to sequence<Node>.

      - [x] [Spec Issue 108](https://github.com/w3c/webcomponents/issues/108)
      - [ ] File a bug and implement it in Blink

- [ ] The Slots Proposal

- [ ] Closed Shadow Trees

      - [ ] [Chromium Issue](https://code.google.com/p/chromium/issues/detail?id=459136)

- [ ] Make createShadowRoot() throws an Exception for some elements.

      - [ ] [Spec Issue #102](https://github.com/w3c/webcomponents/issues/102)
      - [ ] Implement it in Blink.

- [ ] event.scoped

      - [x] [Spec Issue #107](https://github.com/w3c/webcomponents/issues/107)
      - [ ] [Spec Issue #61](https://github.com/w3c/webcomponents/issues/61)
      - [ ] Implement it in Blink. Bug should be filed later.

- [ ] Remove multiple shadow roots

      - [ ] [Chromium Issue #489947](https://code.google.com/p/chromium/issues/detail?id=489947)

- [ ] Remove shadow-piecing descendant combinator, `/deep/`

      - [ ] [Chromium Issue #489954](https://code.google.com/p/chromium/issues/detail?id=489954)

- [ ] Remove shadow-pseudo element, `::shadow`

      - [ ] [Chromium Issue #489954](https://code.google.com/p/chromium/issues/detail?id=489954)

<a name="unified-distribution"></a> It looks that `Element.createShadowRoot()` and `<content>` were removed from the spec. Does Blink continue to support `createShadowRoot` and `<content>`?
---

TL;DR: *Yes*.

For convenience, let's define `v0` and `v1` as follows:

- v0: `Element.createShadowRoot`, insertion points (`<content>`) and accompanying distribution algorithm and APIs, which were defined in the past before *v1* came to the spec.
- v1: `Element.attachShadow`, slots (`<slot>`) and accompanying distribution algorithm and APIs, which other browser vendor will implement.

To continue to support existing users and deployed apps, I've decided to support both, *v0* and *v1*, in Blink.
Because the Shadow DOM spec is inappropriate place to explain how *v0* and *v1* interact each other, let me explain that here, as an *unofficial spec*.

Disclaimer: This is a tentative plan. If I encounter a technical difficulty to support both, I might change the plan. In any cases, I'll do the best effort to continue to support *v0* in Blink.


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

I'm Blink Contributor. What's the impact of v1 for our codebase?
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
