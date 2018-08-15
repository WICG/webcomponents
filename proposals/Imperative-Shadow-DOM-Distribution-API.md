# Imperative Shadow DOM Distribution API

hayato@google.com

The straw-man proposal for Imperative Shadow DOM distribution API.
The context is: [https://github.com/whatwg/html/issues/3534](https://github.com/whatwg/html/issues/3534)

# Declarative API and Imperative API should be exclusively used in each shadow tree

Mixing declarative API and imperative API would be troublesome and can be the cause of confusions for web developers.
We *can* invent complex rules, however, no one wants to remember complex rules. Also, supporting both in the same shadow tree would make a browser engine complex, which I don't want.

Thus, we don't allow mixing declarative API and imperative API in the same shadow tree.
Web developers have to show their *opt-in* to use imperative API for each shadow tree.

A shadow root has an associated *slotting*. Web developers can set shadow root's *slotting* to *manual* by specifying it in attachShadow:

```js
const sr = attachShadow({ mode: ..., (optional) slotting: 'manual' })
```

The *manual* means "we support only imperative APIs for the shadow tree".
The default is "we support only declarative API for the shadow tree".


# Imperative Slotting API

In addition to [assigned nodes], which is already defined in DOM Standard,
a slot has an associated *manually-assigned-nodes* (ordered list). Unless stated otherwise, it is empty.

[assigned nodes]: https://dom.spec.whatwg.org/#slot-assigned-nodes

A slot gets new API, called *assign* (tentative name).

Basically, `slot.assign(sequence<Node> nodes)` sets the slot's *manually-assigned-nodes* to *nodes*. See the later section for details.

- *manually-assigned-nodes* is an internal field. It is write-only. Users cannot read the value directly.

- *manually-assigned-nodes* are different than [assigned nodes]. For example, users can pass a node which is not host's children. We don't throw an exception even if such a *invalid* node is passed, however, *invalid* node is never selected as [assigned nodes]; the engine recaluculate [assigned nodes] later, based on *manually-assigned-nodes*. Invalid nodes in *manually-assigned-nodes* are simply ignored. The caculataed [assigned nodes] are only observable.

See also the Example 3 later.

# Changes to HTML Standard

## HTMLSlotElement

``` webidl
partial interface HTMLSlotElement {
  ...
  void assign(sequence<Node> nodes)
}

```

`slot.assign(sequence<Node> nodes)` runs the following steps:

1. Set the slot's *manually-assigned-nodes* to *nodes*.
2. Run [assign slotables for a tree] with slot’s tree.

step 2 is required because we have to re-calculate [assigned nodes] of every slots in the tree at this timing.

Note: The detail is explained later, however, it would be worth noting that *manually-assigned-nodes* is not used as
[assigned nodes] as is. You can think that `slot.assign(sequence<Node> nodes)` tell the engine *candidate nodes* from where [assigned nodes] are constructed.

[assign slotables for a tree]: https://dom.spec.whatwg.org/#assign-slotables-for-a-tree

# Changes to DOM Standard

## ShadowRootInit


``` webidl
ShadowRootInit {
   ...
   (optional) sloting: 'manual'|'auto' //  (if omitted, it is 'auto');
}

```

## 4.2.2.3. Finding slots and slotables

[To find a slot] need to be updated.
Other steps don't need to be updated from the standard's perspective, I think, thanks to well-factored each steps.

[To find a slot] for a given slotable *slotable* and an optional open flag (unset unless stated otherwise), run these steps:


1. If slotable’s parent is null, then return null.

2. Let shadow be slotable’s parent’s shadow root.

3. If shadow is null, then return null.

4. If the open flag is set and shadow’s mode is not "open", then return null.

5. [New Step] If shadow's *slotting* is *manual*, return the first slot in shadow’s tree whose *manually-assigned-nodes* includes slotable, if any, and null otherwise.

6. Otherwise, return the first slot in shadow’s tree whose name is slotable’s name, if any, and null otherwise. (<= No change)

Note: This change implies:

-   *manually-assigned-nodes* should be considered an implementation detail. As long as the external behavior doesn't change, UA doesn't allocate *manually-assigned-nodes* for a slot.
-   *manually-assigned-nodes* is used only when a slot is in a shadow tree whose *slotting* is *manual*.
-   *manually-assigned-nodes* is not used when a slot is in a shadow tree whose *slotting* is *auto*.

    Web developers can call `slot.assign(...)` for such a slot, however, it is a sort of *no-op*, at least until the slot is moved to another shadow tree with 'manual', where *manually-assigned-nodes* might have a meaning (but it is unlikely).

-   If the same node is set to *manually-assigned-nodes* of more than one slots, the first slot in tree-order takes that node. The slot's location in the tree matters, as declarative API does so.


[To find a slot]: https://dom.spec.whatwg.org/#find-a-slot

# Examples

## Example 1: How imperative slotting API works in slotting=manual.

``` text
host
├──/shadowroot (slotting=manual)
│   ├── slot1
│   └── slot2
├── A
└── B

```

``` javascript
// '==' means ArrayEquals.
assert(slot1.assignedNodes() == []);
assert(slot2.assignedNodes() == []);

slot2.assign([A]);

assert(slot2.assignedNodes() == [A]);

slot1.assign([B, A]);  // The order doesn't matter.

assert(slot1.assignedNodes() == [A, B]);

slot2.assign([A, B]);  // The first slot in tree-order takes the node.

assert(slot1.assignedNodes() == [A, B]);
assert(slot2.assignedNodes() == []);

slot1.assign(A);

assert(slot1.assignedNodes() == [A]);  // slot1 lost B.
assert(slot2.assignedNodes() == [B]);  // slot2 got B.

slot1.assign([A, A, A, host]);   // We don't throw an exepction here.

assert(slot1.assignedNodes() == [A]);
assert(slot2.assignedNodes() == [B]);

slot1.assign([]);

assert(slot1.assignedNodes() == []);
assert(slot2.assignedNodes() == [A, B]);

slot2.assign([]);

assert(slot1.assignedNodes() == []);
assert(slot2.assignedNodes() == []);

```

## Example 2: Imperative slotting API doesn't have any effect in a shadow root with slotting=auto.


``` text

host
├──/shadowroot (slotting=auto) (default)
│   ├── slot1 name=slot1
│   └── slot2 name=slot2
├── A slot=slot1
└── B slot=slot2
```

``` javascript

assert(slot1.assignedNodes() == [A]);
assert(slot2.assignedNodes() == [B]);

slot1.assign([A, B]);  // This doesn't have any effect because this shadow tree's slotting is auto

assert(slot1.assignedNodes() == [A]);
assert(slot2.assignedNodes() == [B]);

```


## Example 3: Inappropriate nodes are ignored, and doesn't appear in slot.assignedNodes()


``` text

host1
├──/shadowroot1 (slotting=manual)
│   └── slot1
└── A

host2
├──/shadowroot2 (slotting=manual)
│   └── slot2
└── B
    └── C

```

``` javascript

slot2.assign([A, B, C]);
assert(slot2.assignedNodes() == [B]); // A is excluded here because A is other shadow tree's host's child.

slot1.assign([A]);
assert(slot1.assignedNodes() == [A]);

shadowroot2.append(slot1);
assert(slot1.assignedNodes() == []);  // A is no longer slot1's shadow tree's child.

shadowroot1.append(slot1);
assert(slot1.assignedNodes() == [A]); // Now A is slot1's shadow tree's child.

```


## Example 4: A node can be appended to a host after the node is imperatively assigned to a slot

``` text

host
└──/shadowroot (slotting=manual)
    └── slot1
```

``` javascript

assert(slot1.assignedNodes() == []);

const a = document.createElement('div');
const b = document.createElement('div');
slot1.assign([a, b]);   // We don't throw an exception

assert(slot1.assignedNodes() == []);   // Neither A nor B is slot1's shadow tree's host's child

host.append(a);
assert(slot1.assignedNodes() == [a]);

host.append(b);
assert(slot1.assignedNodes() == [a, b]);
```

# Open Questions

-   Should we reset *manually-assigned-nodes* at some timings? e.g. when a slot is connected / or disconnected.

    The current proposal never resets *manually-assigned-nodes*. This rule is easy to remember.
    That would cover the most use cases, I think.

-   Using `sequence<Node>` would be a right choice in slot.assign, given that the order doesn't matter?

    If WebIDL has a better type, like `Set<Node>`, we should use it.
