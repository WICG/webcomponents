Different view for Multiple Shadow Roots
==========================

WIP. This will be a page which is a follow-up for https://www.w3.org/Bugs/Public/show_bug.cgi?id=23887#c191

----

Caution: This page is intended for implementors of Shadow DOM, rather than for web-dev.


Have you wondered a reason why a [tree of trees] [tree of trees] defines that older shadow tree is the [parent tree] of the younger tree?  Shouldn't they are sibling trees? If you are interested in the reason, please continue reading.

[tree of trees]: http://w3c.github.io/webcomponents/spec/shadow/#trees-of-trees
[parent tree]: http://w3c.github.io/webcomponents/spec/shadow/#dfn-parent-tree

"Multiple Shadow Roots" as a syntax sugar for the different world.
------

Shadow DOM spec has a concept of [Multiple Shadow Roots]: One element can host *more than* one shadow roots.

However, I can explain [Multiple Shadow Roots] without this *Multiple-ness*. Welcome to this *mirrored* world.
In this different world, there is no [Multiple Shadow Roots] concept.
An element can host only one Shadow Root. The mirrored world lacks this ability.
However, to be fair, the mirrored world have the following feature: "A Shadow Root can host another Shadow Root."

As a result, both worlds have an equivalent power. Let me explain the equivalence by examples.

[Multiple Shadow Roots]: http://w3c.github.io/webcomponents/spec/shadow/#dfn-shadow-roots-list

In the Multiple Shadow Roots World
------

Suppose an element, `host`, hosts three Shadow Roots, [SR1, SR2, SR3], where SR1 is the oldest shadow root,  SR3 is the youngest shadow root.

        var sr1 = host.createShadowRoot();
        var sr2 = host.createShadowRoot();
        var sr3 = host.createShadowRoot();

        // host ==(hosts)==> [sr1, sr2, sr3]

In the Different World
------
Remember that Shadow Root also supports createShadowRoot() in this mirrored world.
You can write the equivalent as follows:

        var sr1 = host.createShadowRoot();
        var sr2 = sr1.createShadowRoot();
        var sr3 = sr2.createShadowRoot();

Here, there are three shadow hosts, `host`, `sr1` and `sr2`. Each hosts `sr1`, `sr2` and `sr3`, respectively.

        // host ==(hosts)==> sr1 ==(hosts)==> sr2 ==(hosts) ==> sr3


What does it mean?
------

Have you noticeed the similality between 1 and 2 in the following?

1. The relationship between Shadow Host and it's (oldest) Shadow Root
2. The relationship between the older Shadow Root and it's younger Shadow Root

There is no *significant* difference between A and B. Let's think how browser works for them:

>    "I'm a Browser. I'm now about to render an element, `A`.
>    Wait. This elment `A` is hosting the (oldest) shadow root, `SR1`. Okay, I won't travese the child nodes of `A`. Instead, let me go down to `SR1` and continue rendering from there"

>    "I'm a Browser. I'm now about to render an shadow root, `SR1`.
>    Wait. This `SR1` *hosts* the (younger) shadow root, `SR2`.  Okay, I won't traverse the child nodes of `SR1`. Instead, let me go down to `SR2` and continue rendering from there"

>    "I'm a Browser. I'm now about to render an shadow root, `SR2`.
>    Wait. This `SR2` *hosts* the (youngest) shadow root, `SR3`.  Okay, I won't render the child nodes of `SR2`. Instead, let me go down to `SR3` and continue rendering from there"


That means, in any worlds, instead of (child nodes of) an element A, (a subtree of) SR3 is going to be rendered. Nothing has changed from the user's perspective.


What benefits can we get from this different view?
------

Good question. The difference sounds like a kind of an implementation details. Who should care for that?

I care. I've seen a lot of benefits from this different view when I was thinking an algorithm in the Shadow DOM spec. This actually made the spec *much* simpler, though I guess you didn't think so. :)

For example, thanks to the definition of tree of trees, I don't have to mention about Multiple Shadow Roots at defining [Event Retargeting] algorithm, [Event RelatedTarget Retargeting] algorithm and so on. I can use a *familiar* term like the *lowest common ancestor tree*.

[Event Retargeting]:  http://w3c.github.io/webcomponents/spec/shadow/#event-retargeting. 
[Event RelatedTarget Retargeting]:  http://w3c.github.io/webcomponents/spec/shadow/#retargeting-relatedtarget

Now I've found that [event path] calculation algorithm can get benefits too. See the [comment](https://www.w3.org/Bugs/Public/show_bug.cgi?id=23887#c191).

[event path]: http://w3c.github.io/webcomponents/spec/shadow/#event-paths

There, we don't need to distinguish between content insertion points and shadow insertion points at all. {older shadow roots, younger shadow roots, oldest shadow roots, youngest shadow roots} neither.

The benefits are: Those algorithms don't have to pay attention to the existence of "Multiple Shadow Roots". Those algorithm don't change at all if we were to remove "Multiple Shadow Roots" from the spec. Benefits.

Appendix
-----

Imagine that we are living in the mirrored world, where ShadowRoot supports ShadowRoot.createShadowRoot() API. No one in this world uses a term of "Multiple Shadow Roots".

In this mirrored world, if you were to support Element.createShadowRoot() which behaves as the current spec defines, we could implement it easily as follows:

        function createShadowRootWrapperForMultipleShadowRootsWorld() {
          if (this.shadowRoot()) {
            return this.shadowRoot().createShadowRootWrapperForMultipleShadowRootsWorld();
          } else {
            return this.createShadowRoot();
          }
        }

The similar thing also applies to the current `Element.shadowRoot()` API, which returns the youngest shadow root, rather than oldest shadow root. The following is the implementation:

        function youngestShadowRootWrapperForMultipleShadowRootsWorld() {
            var sr = this.shadowRoot();
            if (!sr) return null;
            while (sr.shadowRoot()) {
              sr = sr.shadowRoot();
            }
            return sr;
          }
        }

You can think the current APIs are just wrappers to support *pseudo* "Multiple Shadow Roots" in the mirrored world.
