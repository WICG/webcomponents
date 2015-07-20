# Slots Proposal

### Definitions

These are the new definitions. For all other definitions, consult current [spec](http://w3c.github.io/webcomponents/spec/shadow/).

* **slot** -- a defined location in a shadow tree. Represented by the ```slot``` element.
* **slot name** -- the name of a **slot**.
* **default slot** -- a **slot** for assigning nodes without a **slot name**.

### Slotting Algorithm

The **slotting** algorithm assigns nodes of a shadow tree host into *slots* of that tree.

**Input**
  *HOST* -- a shadow tree host
**Output**
  All child nodes of *HOST* are slotted

1. Let *TREE* be *HOST*'s shadow tree
2. Let *DEFAULT* be an empty list of nodes
3. For each child node *NODE* of *HOST*, in tree order:
  1. Let *NAME* be *NODE*'s **slot name**
  2. If *NAME* is missing, add *NODE* to *DEFAULT*
  3. Let *SLOT* be the slot with **slot name** *NAME* for *TREE*
  4. If *SLOT* does not exist, discard node
  5. Otherwise, assign *NODE* to *SLOT*
4. Let *DEFAULT-SLOT* be the the **default slot** for *TREE*
5. If *DEFAULT-SLOT* does not exist, **stop**
6. Otherwise, assign all nodes in *DEFAULT* to *DEFAULT-SLOT*.

When each node is assigned to a slot, this slot is also added to the node's [destination insertion points](http://w3c.github.io/webcomponents/spec/shadow/#dfn-destination-insertion-points) list.

### Get Distributed Nodes Algorithm

The **get distributed nodes** algorithm recursively collects all nodes that are currently distributed into a given **slot**

**Input**
 *SLOT* -- a **slot** in a shadow tree
**Output**
 *LIST* - a list of distributed nodes

1. For each node *NODE* that is assigned to *SLOT*:
  1. If *NODE* is a **slot**:
    1. Let *SUB-LIST* be the result of (recursively) running the **get distributed nodes** algorithm with *NODE* as argument
    2. Append all nodes in *SUB-LIST* to *LIST*
  2. Otherwise, append *NODE* to *LIST*.

### Distribution Resolution Algorithm

This algorithm replaces the [**distribution resolution algorithm**](http://w3c.github.io/webcomponents/spec/shadow/#dfn-distribution-resolution-algorithm) from the current spec.

**Input**
  *NODE-TREE* -- a node tree
**Output**
  The distribution result is updated.

1. For each shadow host *HOST*, which participates in *NODE-TREE*, in tree order:
  1. Run **slotting** algorithm with **HOST** as argument
  1. Let **SHADOW-TREE** be *HOST*'s shadow tree
  1. Run **distribution resolution algorithm* (recursively) with *SHADOW-TREE* as input

### `slot` element

```slot``` element represents a **slot** in the shadow tree. Has same rendering behavior as the ```content``` element.

Attributes:
* ```name``` -- the name of the slot.

```WebIDL
interface HTMLSlotElement : HTMLElement {
  attribute DOMString name;
  NodeList getDistributedNodes();
}
```

* ```name``` -- reflects the ```name``` attribute.
*  ```getDistributedNodes``` --- returns result of running the *get distributed nodes* algorithm.

### Extensions to ```Element```

```WebIDL
partial interface Element {
  attribute DOMString slot;
}
```

* ```slot``` -- reflects the ```slot``` attribute. The ```slot``` attribute represents the **slot name**.
