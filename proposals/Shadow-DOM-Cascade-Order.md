# Cascade Order for CSS rules from different shadow trees

#### by Rune Lillesveen

The current [CSS Scoping][css-scoping] draft adds a new cascade level for
choosing between style rules from inner/outer shadow trees. However, it
does not mention rules from different shadow trees which do not have an
inner/outer relationship which causes comparison of such rule to fall
through to comparing specificity and order of appearance, in the cases
where the specificity is equal. This even causes circularity-like issues
as discussed in [this thread][www-style-thread].

Rules from two different shadow trees without an inner/outer relationship
typically apply to the same element in cases where the element has multiple
ancestors which are distributed to insertion points, and those two rules
use the ::content selector.

An example:

    <menu>
        <:shadow>
            <style>::content menu-item { color: green }</style>
            <content/>
        </:shadow>
        <menu-item>
            <:shadow>
                <style>:host { color: black }</style>
                <content/>
            </:shadow>
            ITEM
        </menu-item>
    </menu>

The two shadow trees above do not have an inner/outer relationship in the
tree-of-trees order, which means the specificity will decide if the
menu-item becomes green or black.

An author should not have to care about specificity of rules inside a web
component when styling the element for that component. Instead, we should
compare all rules from different shadow trees at the same cascade level
as the current inner/outer comparison.


## Proposed Changes to [CSS Scoping][css-scoping]

These changes were originally proposed on [www-style][www-style-proposal].

There is a Blink implementation of the the proposed changes
[here][blink-patch].
Note that the current Blink implementation does not match the current CSS
Scoping draft, so that patch may be confusing if you try to correlate with
this proposal.

### Proposal 1

Replace this text in [3.3.1][css-scoping-cascading]:

"When comparing two declarations, if one of them is in a shadow tree
and the other is in a document that contains that shadow tree, then
for normal rules the declaration from the outer document wins, and for
important rules the declaration from the shadow tree wins."

with:

"When comparing two declarations from different shadow trees, then for
normal rules the declaration from the tree which comes first in the
tree of trees order wins, and for important rules the declaration from
the tree which comes last in the tree-of-trees order wins. The tree of
trees order is defined by the Shadow DOM specification."

### Proposal 2

Given the change above, order of appearance will never apply when
comparing declarations from different shadow trees, just order of
appearance within one tree. Hence, I think this sentence can be
removed, as it will just add confusion:

"When calculating Order of Appearance, the tree of trees, defined by
the Shadow DOM specification, is used to calculate ordering."

### Multiple shadow roots

The tree of trees ordering of multiple shadow roots is now gone from
the Shadow DOM spec draft, but if I look at the latest published WD,
the tree of trees ordering says the oldest shadow root comes first,
which is the opposite of what is the case when constructing the event
path or the composed tree, so I think that looks inconsistent. I
haven't studied the Shadow DOM spec in enough detail to say if
ordering shadow roots the other way around for tree of trees ordering
would actually make a difference for the rest of that spec, but if the
tree of trees ordering was the other way around for multiple shadow
roots, Proposal 1 above would also cover the multiple shadow
roots case.

Now, since multiple shadow roots are already gone from the Shadow DOM
draft for v1, the sentence where we describe cascade order for such
trees can be removed regardlessly.

#### Proposal 3

Drop the following text:

"When comparing two declarations, if both are in shadow trees with the
same host element, then for normal rules the declaration from the
shadow tree that was created most recently wins, and for important
rules the declaration from the shadow tree that was created less
recently wins."


#### Clarification

I don't know if this is obvious, as there are special casing for
declarations from the style attributes in connection with scoped
stylesheets in [CSS Cascade][css-cascade-scope], but I think declarations
from style attributes should belong to the same tree in terms of cascading
as the element on which it is set. That means, whether an element inside a
shadow tree is styled through a stylesheet rule in the shadow tree, or a
style attribute on that element should not affect the cascade order of
that declaration and a declaration from the outer tree.

Should this be made explicit in the spec, or does that follow directly
from the fact that the attribute, hence the declaration, lives in the
same tree as the element on which it is set?

[css-scoping]: http://dev.w3.org/csswg/css-scoping-1/
[css-scoping-cascading]: http://dev.w3.org/csswg/css-scoping-1/#cascading
[css-cascade-scope]: http://dev.w3.org/csswg/css-cascade-3/#cascade-scope
[www-style-thread]: https://lists.w3.org/Archives/Public/www-style/2015Feb/0133.html
[www-style-proposal]: https://lists.w3.org/Archives/Public/www-style/2015Jun/0303.html
[blink-patch]: https://codereview.chromium.org/1224673002/
