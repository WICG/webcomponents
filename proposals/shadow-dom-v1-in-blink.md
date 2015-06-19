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

- [ ] Closed Shadow Trees

      - [x] [Spec Issue #85](https://github.com/w3c/webcomponents/issues/85)
      - [ ] [Spec Issue #100](https://github.com/w3c/webcomponents/issues/100)

- [ ] Slots Proposal

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

It's unclear how the Slots Proposal, `<slot>`, interacts with the `<content>`, which is likely to be deprecated.
---

- [ ] I have to tackle this painful issue later in Blink once the Slots proposal will be clear. I'm afraid that it would be extremely difficult to support both model co-exist in the same tree of trees. Blink has to compromise at some level.


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
