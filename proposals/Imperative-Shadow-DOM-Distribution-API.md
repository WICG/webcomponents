# Imperative Shadow DOM Distribution API

Authors: yuzhehan@chromium.org, hayato@google.com

This is a strawperson proposal for Imperative Shadow DOM distribution API.
For more context, please see [the WHATWG HTML Standard issue](https://github.com/whatwg/html/issues/3534).

## Motivation

One of the drawbacks of Shadow DOM v1, when compared to Shadow DOM v0, is that web developers have to specify slot= attribute for every shadow host's children (except for elements for the *default* slot).
 
#### Case 1:  Slot attributes is required in markup.
```html
<shadow-host>
  <div slot=slot1></div>
  <div slot=slot2></div>
</shadow-host>
 ```
Some people would see this as a kind of *ugly* markup.
Shadow DOM v1 can't explain how `<summary>/<details>` elements can be implemented on the top of the current Web Components technology stack, given that `<details>` element doesn't need slot= attribute.
Blink has a special logic for some built-in elements to control node-to-slot mapping.
 
#### Case 2: Slot based on condition. 
```html
<custom-tab show-panel="2">
   <tab-panel></tab-panel>
   <tab-panel></tab-panel>
   <tab-panel></tab-panel>
</custom-tab>
 ```
The second issue is that component creators can't change the slotting behavior based on condition. In the above markup, the `<custom-tab>` component can't implement which `<tab-panel>` to show based on its attribute `show-panel`.

## Imperative Slotting API

The imperative slotting API allows the developer to explicitly set the [assigned nodes] for a slot element.

[assigned nodes]: https://dom.spec.whatwg.org/#slot-assigned-nodes

An `HTMLSlotElement` gets a new API, called `assign(sequence<Node> nodes)` (tentative name). Nodes are an ordered list of `slot's` host light DOM children. 
 
#### Example Usage
The following code demonstrate how to use the new API to solve [Case 2](#Case-2:-Slot-based-on-condition) of the Motivation section above.

```js
class CustomTab extends HTMLElement {
    constructor() {
        super();
        const template = `
            <div class="custom-tab">
                <slot></slot>
            </div>`;
        const shadowRoot = this.attachShadow({mode: 'open', slotAssignment: 'manual'});
        const div = document.createElement('div');
        div.innerHTML = template;
        shadowRoot.appendChild(div);
    }
    connectedCallback() {
        if (!this._observed) {
           const target = this;
           const showPanel = this.getAttribute('show-panel');
           this._slot = this.shadowRoot.querySelector("slot");
           const observer = new MutationObserver(function(mutations) {
                const panels = target.querySelectorAll('tab-panel');
                if (panels.length && showPanel > 0 && showPanel <= panels.length ) {
                  target._slot.assign([panels[showTab-1]]);
                } 
            });
            observer.observe(this, {childList: true});
            this._observed = true;
        }
    }
}
```

## Declarative API and Imperative API should be exclusively used in each shadow tree

Mixing declarative API and imperative API would be troublesome and can cause confusion for web developers.
We *can* invent complex rules. However, no one wants to remember complex rules. Also, supporting both in the same shadow tree would make a browser engine complex.

Thus, we don't allow mixing the declarative and imperative APIs in the same shadow tree. Web developers must explicitly opt-in
to use an imperative API for each shadow tree. They do this with a new "slotAssignment" parameter on attachShadow():

```js
const sr = attachShadow({ mode: 'open', slotAssignment: 'manual' });
```

Here, "manual" means "we support only imperative APIs for the shadow tree". If no calls to `slot.assign()` are made, then [assigned nodes] will be left empty.
The default, "auto", means to use the existing declarative slotting algorithm. In this case, calls to `slot.assign()` will throw an exception.

## Changes to HTML Standard

### HTMLSlotElement

``` webidl
partial interface HTMLSlotElement {
  ...
  void assign(sequence<Node> nodes)
}

```

`slot.assign(sequence<Node> nodes)` runs the following steps:

1. Check `slotAssignment` is "manual", throw otherwise.
2. Validate each node in nodes that its node.parentNode == slot.rootNode.host. Throw if not equal.
3. Set the slot's `manuallyAssignedNodes` to `nodes`.
4. Run [assign slotables for a tree] with slot's tree.

Step 4 is required because we have to re-calculate [assigned nodes] of every slot in the tree at this timing.

Note: It would be worth noting that `manuallyAssignedNodes` is not used as
[assigned nodes] as is. You can think of `slot.assign(sequence<Node> nodes)` as telling the engine a set of "candidate nodes" from which [assigned nodes] are constructed.

[assign slotables for a tree]: https://dom.spec.whatwg.org/#assign-slotables-for-a-tree

## Changes to DOM Standard

### [Shadow Root Init](https://dom.spec.whatwg.org/#dictdef-shadowrootinit)

``` webidl
dictionary ShadowRootInit {
  required ShadowRootMode mode;
  boolean delegatesFocus = false;
  SlotAssignmentMode slotAssignment = "auto";
};
```

### [Shadow Root](https://dom.spec.whatwg.org/#shadowroot) 

``` webidl
[Exposed=Window]
interface ShadowRoot : DocumentFragment {
  readonly attribute ShadowRootMode mode;
  readonly attribute Element host;
  attribute EventHandler onslotchange;
  readonly attribute SlotAssignmentMode slotAssignment;
};

enum ShadowRootMode { "open", "closed" };
enum SlotAssignmentMode { "manual", "auto" };
```

### 4.2.2.3. Finding slots and slotables

[To find a slot] needs to be updated here. The other steps don't appear to require any updates from the standard's perspective.

[To find a slot] for a given slotable *slotable* and an optional open flag (unset unless stated otherwise), run these steps:

1. If slotable's parent is null, then return null.

2. Let shadow be slotable's parent's shadow root.

3. If shadow is null, then return null.

4. If the open flag is set and shadow's mode is not "open", then return null.

5. [New Step] If shadow's `slotAssignment` is "manual", return the associated slot in shadow's tree whose `manuallyAssignedNodes` includes slotable, if any, and null otherwise.

6. Return the first slot in shadow's tree whose name is slotable's name, if any, and null otherwise. (<= No change)

Note: This change implies:

-   `manuallyAssignedNodes` should be considered an implementation detail. As long as the external behavior doesn't change, UA doesn't allocate `manuallyAssignedNodes` for a slot.
-   `manuallyAssignedNodes` is used only when a slot is in a shadow tree whose `slotAssignment` is "manual".
-   `manuallyAssignedNodes` is not used when a slot is in a shadow tree whose `slotAssignment` is "auto".

     Web developers can not call `slot.assign(...)` for such a slot, it will throw exception to keep it consistent with when invalid nodes are passed in the "manual" case.

-   If the same node is set to `manuallyAssignedNodes` when it's already an assigned node in another slot, the node will removed from the previous slot and assigned to the new slot. The "slotchange" event will be raised for both slots.

[To find a slot]: https://dom.spec.whatwg.org/#find-a-slot

## Examples

### Example 1: How imperative slotting API works in slotAssignment=manual.

```text
host
├──/shadowroot (slotAssignment=manual)
│   ├── slot1
│   └── slot2
├── A
└── B
```

```javascript
assert_array_equals(slot1.assignedNodes(), []);
assert_array_equals(slot2.assignedNodes(), []);

slot2.assign([A]);

assert_array_equals(slot2.assignedNodes(), [A]);

slot1.assign([B, A]);  // The order does matter.

assert_array_equals(slot1.assignedNodes(), [B, A]);
assert_array_equals(slot2.assignedNodes(), []);

slot2.assign([A, B]);  // Assignment is absolute, order is preserved.

assert_array_equals(slot1.assignedNodes(), []);
assert_array_equals(slot2.assignedNodes(), [A, B]);

slot1.assign(A);

assert_array_equals(slot1.assignedNodes(), [A]);  // slot1 got A.
assert_array_equals(slot2.assignedNodes(), [B]);  // slot2 lost A.

slot1.assign([A, A, A]);
assert_array_equals(slot1.assignedNodes(), [A]);

slot1.assign([A, B, A]);   // Last one wins
assert_array_equals(slot1.assignedNodes(), [B, A]);

slot1.assign([host]);      // Exception is thrown.

assert_array_equals(slot1.assignedNodes(), [B, A]); // Existing assignment doesn't change.
assert_array_equals(slot2.assignedNodes(), []);

slot1.assign([]);

assert_array_equals(slot1.assignedNodes(), []);
assert_array_equals(slot2.assignedNodes(), []);
```

### Example 2: Imperative slotting API doesn't have any effect in a shadow root with slotAssignment=auto.


```text
host
├──/shadowroot (slotAssignment=auto) (default)
│   ├── slot1 name=slot1
│   └── slot2 name=slot2
├── A slot=slot1
└── B slot=slot2
```

```javascript
assert_array_equals(slot1.assignedNodes(), [A]);
assert_array_equals(slot2.assignedNodes(), [B]);

slot1.assign([A, B]);  // Throw exception, not manual mode and A or B can't be assigned to slot.

assert_array_equals(slot1.assignedNodes(), [A]);
assert_array_equals(slot2.assignedNodes(), [B]);
```


### Example 3: Inappropriate nodes will cause an exception to be thrown, slot returns to its previous state.


```text
host1
├──/shadowroot1 (slotAssignment=manual)
│   └── slot1
└── A

host2
├──/shadowroot2 (slotAssignment=manual)
│   └── slot2
└── B
    └── C
```

```javascript
slot2.assign([A, B, C]);  // Throws exception - A and C are illegal here.
assert_array_equals(slot2.assignedNodes(), []); 

slot1.assign([A]);
assert_array_equals(slot1.assignedNodes(), [A]);

shadowroot2.append(slot1);             // Allows append, and appendChild, don't need to change spec for throwing exceptions for append().
assert_array_equals(slot1.assignedNodes(), []);   // A is not a light dom node of shadowroot2, thus removed.
assert(slot1.getRootNode() == shadowroot2);

shadowroot1.append(slot1);
assert_array_equals(slot1.assignedNodes(), []);   // Assignment is absolute. Once slotables are removed, they need to be assigned again.
```

### Example 4: A node can be appended to a host, but it must still be imperatively assigned to slot afterward.

```text
host
└──/shadowroot (slotAssignment=manual)
    └── slot1
```

```javascript
assert_array_equals(slot1.assignedNodes(), []);

const A = document.createElement('div');
const B = document.createElement('div');
slot1.assign([A, B]);   // throw an exception
assert_array_equals(slot1.assignedNodes(), []);   // Neither A nor B is slot1's shadow tree's host's child

host.append(A);
assert_array_equals(slot1.assignedNodes(), []);

slot1.assign([A]);    // Assign is absolute. 
assert_array_equals(slot1.assignedNodes(), [A]);  

host.append(B);
assert_array_equals(slot1.assignedNodes(), [A]);  // B must be manually slotted
slot1.assign([A, B])
assert_array_equals(slot1.assignedNodes(), [A, B]);
```

### Example 5: slotchange event is raised when the list of assigned nodes or their order changes.

```text
host1
├──/shadowroot1 (slotAssignment=manual)
│   ├── slot1
│   └── slot2
├── A
└── B

host3
├──/shadowroot3 (slotAssignment=manual)
│   └── slot3
```

```javascript
assert_array_equals(slot1.assignedNodes(), []);
assert_array_equals(slot2.assignedNodes(), []);
assert_array_equals(slot3.assignedNodes(), []);

// assigned node change triggers slotchange event.
slot2.assign([A]);  // slot2 dispatches slotchange event.
assert_array_equals(slot2.assignedNodes(), [A]);

// Both slot1 and slot 2 will be notified.
slot1.assign([B, A]);  // slot1 dispatches slotchange event and slot2 dispatches shotchange event.
assert_array_equals(slot1.assignedNodes(), [B, A]);
assert_array_equals(slot2.assignedNodes(), []);

// Node list order change fires slot change event.
slot1.assign([A, B]);  // slot1 dispatches slotchange event.
assert_array_equals(slot1.assignedNodes(), [A, B]);

// Exception doesn't trigger a slotchange event.
slot1.assign([A, A, A, host]);   // Exception is thrown.  No slotchange event. 
assert_array_equals(slot1.assignedNodes(), [A, B]);

shadowroot3.append(slot1);     // slot1 dispatches slotchange event
assert_array_equals(slot1.assignedNodes(), []);

```
## Appendix
#### Internal Implementation details

Let `manuallyAssignedNodes` be a internal property of `HTMLSlotElement` where it stores an ordered list of nodes when its shadowroot's SlotAssignmentMode is `manual`. Unless stated otherwise, it is empty.

Basically, `slot.assign(sequence<Node> nodes)` sets the slot's `manuallyAssignedNodes` to `nodes`.

- *manuallyAssignedNodes* is an internal field. It is write-only. Users cannot read the value directly.
- *manuallyAssignedNodes* are different than [assigned nodes]. They are candidates for slot assignments. However, we check each node's slotable validity. If an invalid node is detected, we throw an exception in `slot.assign()` and clear `manuallyAssignedNodes`. If the validity check is successful, the browser recalculates [assigned nodes] later, based on `manuallyAssignedNodes`. The calculated [assigned nodes] are then observable.

#### Security and Privacy Considerations

The new API sets the assigned nodes for a slot element. It can't be used to track users. Since it's a new API, maybe its presence can be used in some way to finger print users. However, this would be the case for all new APIs. 
