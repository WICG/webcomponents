Proposals: CSS Cascade Order for Shadow DOM v1
=====

by Hayato Ito (hayato@google.com)
----

It looks there are still confusions in the [issue #316]((https://github.com/w3c/webcomponents/issues/316)).

Definitely, we need a good summary before the meeting on TPAC 2015.


Background
----

The reason we've filed the [Shadow DOM Cascade Order Proposal] and [issue #316] is to resolve the current confusing situation in Blink. There, Shadow DOM v0 is being supported.

Now, however, we're shifting to Shadow DOM v1. I'm feeling that two different problems are being mixed in the issue's discussion. It would be great that we have a clear separation for each.

In summary:

In v0:

-   We have a `/deep/` and `::shadow`
-   We have a `::content`, which can be followed by an arbitrary selector.

    e.g.  `::content div p /deep/ div p ::content h1` is valid.

-    We have `:host` and `:host-context`.

In v1:

-   We have neither `/deep/` and `::shadow`.
-   `::content` was *renamed* to `::slotted`, with a different behavior. Now `::slotted` can take only a simple selector.
    See [Issue #331].

    e.g. `:slottted(div p)` is no longer valid in v1, while `::slottted(div)` is okay.

-   We still have `:host` and `:host-context`.


I'll focus on v1 issue in this document. Let's resolve v0 issue as a separate concern.

Example
----

Here is an example, explaining how a selector defined in various locations can match `host4`.

```html
  <html>
    <style>
       .... { color: #000; }            // never matches host4.
       .... { color: #001 !important; } // never matches host4.
    </style>
    <host1>
      <!-- shadow-root of host1 start -->
        <style>
           host4 { color: #002; }
           host4 { color: #003 !important; }
         </style>
        <host2>
           <!-- shadow-root of host2 start -->
             <style>
                slot::slotted(host4) { color: #004; }
                slot::slotted(host4) { color: #005 !important; }
              </style>
              <host3>
                <!-- shadow-root of host3 start -->
                 <style>
                    slot::slotted(host4) { color: #006; }
                    slot::slotted(host4) { color: #007 !important; }
                  </style>
                  <slot name=slot2>
                  </slot>
                <!-- shadow-root of host3 end -->
                <slot name=slot1 slot=slot2>
                </slot>
              </host3>
           <!-- shadow-root of host2 end -->
           <!-- Note: host4 is a child of host2 -->
           <host4 slot='slot1' style="color: #008" (or style="color: #009 !important")>
             <!-- shadow-root of host3 start -->
               <style>
                  :host { color: #00a; }
                  :host { color: #00b !important; }
                </style>
             <!-- shadow-root of host4 end -->
           </host4>
        </host2>
      <!-- shadow-root of host1 end -->
    </host1>
  </html>
```

The structure of the tree of trees is:

- document tree
    - host1' shadow tree
        - host2' shadow tree
            - host3' shadow tree
        - host4' shadow tree


Analysis
---

Let's analyze the example. Which selectors can be applied on a `host4`?

Note that `host4` is in **host1's shadow tree**.


1.   A selector declared in an ancestor tree of *host1's shadow tree*:

     It never matches a `host4` because we have neither `/deep/` nor `::shadow`.

     e.g. A selector declared in the **document tree** in the example:

     - `... { color: #000; }`

2.   A selectors declared in the same node tree (*host1's shadow tree*):

     It can match `host4`, as usual.

     e.g. A selector in the *host1's shadow tree* in the example:

     - `host4 { color: #002; }`

3.   A selector declared in a direct child tree of *host1's shadow tree*:

     It can match `host4` if a selector has `:host` or `::slotted`

     e.g.

     A selector declared in the **host'2 shadow tree** in the example:

    - `slot::slotted(host4) { color: #004; }`

     A selector declared in the **host'4 shadow tree** in the example:

     - `:host { color: #00a; }`

4.   A selectors declared in an (indirect) descendant tree of *host1's shadow tree*. `Indirect` means it's not a direct child tree

     It can match `host4` because `::slotted` matches the distributed nodes, instead of assigned nodes. Note that we still support *re-distribution* mechanism. See [Composition example] for details.

     e.g

     A selector declared in the **host3's shadow tree** in the example:

     - `slot::slotted(host4) { color: #006; }`

5.   In other cases (There is no ancestor/descendant relation ship)

     It never matches because we don't the have old behavior of `::content`, which can take a arbitary selector, instead of a simple selector.


The summary of the proposals
----

To avoid verbose words, suppose we have a tree of trees whose structure is:

- A
    - B
        - C
            - D
        - E

Let's focus on the node tree **B** and selectors which can match an element in **B**.

We have the following locations where a selector, or a style attribute, is defined, and can be applied to an element in B:


- [A]                     (e.g. color: #000)
- [B]                     (e.g. color: #002)
- [B style-attribute]     (e.g. color: #008)
- [C]                     (e.g. color: #004)
- [D]                     (e.g. color: #006)
- [E]                     (e.g. color: #00a)


As I said, [A] never matches an element in B in the current spec.
However, if we support custom pseudo elements, [Issue #300] , we should consider it.
That's the reason I've added [A] there.


### [Tab's proposal] is:

-  [B style-attribute] > [B] > ([C] or [E])

For `!important` rules,

-   ([C !important] or [E !important]) > [B style-attribute !important] > [B !important] > [B style-attribute] > [B] > ([C] or [E])

Hayato's comment: It sounds that the proposal said that a kind of pseudo-classes (or pseudo-elements) used in a selector, such as `::content` or `:host`, can determines the preference order, but I don't think we have a special rule for `:host` or `:slotted`. A specificity or the order of appearance can be a tie-breaker, can't it?


### Rune's proposal, Option 1 in [Issue #316], is:

- [A] > [B style-attribute] > [B] > [C] > [D] > [E]

Basically, that's the tree order of tree of trees, plus [B style attribute] is inserted in the *middle*, before the [B].

For `!important` rules,

-  [D !important] > [C !important] > [B !important] > [A !important] > [A] > [B style-attribute] > [B] > [C] > [D] > [E]

Todo: Clarify where [B style-attribute !important] is inserted.


###  Option2 in [Issue #316] is:

- [B style-attribute] > [A] > [B] > [C] > [D]

For `!important` rules,

- [B style-attribute !important] > [D !important] > [C !important] > [B !important] > [A !important] > [B style-attribute] > [A] > [B] > [C] > [D]

It looks Option2 is missing the possibility that selectors which are defined in the sibling trees, such as C and E, can match an element in the parent tree of that, such as B.


### Hayato's proposal is:

I have yet another proposal here, clarifying Option2, mixing Rune's proposal:

- [B style-attribute] > [A] > [B] > [C] > [D] > [E]

That's the tree order of tree of trees, plus 'style attribute' is inserted at the beginning, like Option2.

For `!important` rules:

[B style-attribute !important] > [E !important] > [D !important] > [C !important] > [B !important] > [A !important] > [B style-attribute] > [A] > [B] > [C] > [D] > [E]



[Shadow DOM Cascade Order Proposal]: https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Shadow-DOM-Cascade-Order.md
[Issue #300]: https://github.com/w3c/webcomponents/issues/300
[Issue #316]: https://github.com/w3c/webcomponents/issues/316
[Issue #331]: https://github.com/w3c/webcomponents/issues/331
[Composition example]:https://w3c.github.io/webcomponents/spec/shadow/#composition-example

[Tab's proposal]: https://github.com/w3c/webcomponents/issues/316#issuecomment-149735841
