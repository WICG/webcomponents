# Slots Proposal

```slot``` element represents an insertion point (slot?) in the shadow tree. Has same rendering behavior is as the ```content``` element.

Attributes:
* ```name``` -- the name of the slot.

```WebIDL
interface HTMLSlotElement : HTMLElement {
  attribute DOMString name;
  NodeList getDistributedNodes();
}
```

* ```name``` -- reflects the ```name``` attribute.
*  ```getDistributedNodes``` --- returns a static list of nodes, currently distributed into this slot.

```WebIDL
partial interface Element {
  attribute DOMString slot;
}
```

* ```slot``` -- reflects the ```slot``` attribute.
