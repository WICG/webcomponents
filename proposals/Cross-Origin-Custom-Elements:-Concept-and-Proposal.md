###### Prepared by Travis Leithead and Arron Eicholz

*Note: Parts of the below proposal (specifically the Worker-like JS global singleton) are based on a previous proposal by Elliott Sprehn: [DOMWorker](https://docs.google.com/document/d/1V7ci1-lBTY6AJxgN99aCMwjZKCjKv1v3y_7WLtcgM00/edit?pli=1)*

See also, Apple's proposal for solving the same use cases but using a 2-step creation/application process: https://github.com/w3c/webcomponents/wiki/Isolated-Imports-Proposal. 

# Concept

Cross-origin web components are a type of web component that fulfills the requirement for confinement in the Facebook +1 button [use-case](https://wiki.whatwg.org/wiki/Component_Model_Use_Cases). Rather than establishing confinement at the shadow DOM boundary as done in the previous proposal, confinement is obtained through the establishment of a cross-origin custom element (thus use of shadow DOM in the confined component is an optional feature).

Confined components are currently handled by iframes, which additionally require another "agent" script to be loaded directly in the host. The agent facilitates the communication with the iframe content (via `postMessage`). Loading the additional agent is inconvenient and also requires trusting it not to overstep it's described behavior. Furthermore, iframes are also inefficient in that each new "component" instance comes with a new isolated script environment.

When defining a component using custom elements, a custom element prototype is provided which is used as the "template" from which new instances of the custom element are bound and inherit functionality. In a cross-origin component, the boundary of confinement must include a prototype object as well as any instances created from it--necessitating a single JavaScript global environment in order to be most efficient (versus a global environment per custom element instance).

*Note: the words 'confinement/confined' and 'isolated' are used interchangeably to mean the same thing. Also, the terms "outside" DOM and "inside" DOM are from the perspective of the isolated component (i.e., outside the component, and inside the component).*

# Proposal

In this proposed design, a custom element may be optionally defined by a 3rd party URL and provide safe [curated] interaction with the host environment. Several notable design considerations include:

1. Only one isolated JavaScript global environment is created in order to service any/all custom element instances including their shared prototype functionality (no unnecessary duplication of resources). If shadow DOM usage is desired, it can be attached using the same code-patterns as when the custom element is not cross-origin.
2. No corresponding "agent" is necessary in the outer DOM in order to provide the interaction APIs to communicate with the isolated JavaScript environment on the inside.
3. The provided isolation is not dependent on Shadow DOM--shadow DOM is complementary. Like the current distinction between custom elements and shadow DOM, cross-origin custom elements is independent of shadow dom.
4. The cross-origin custom element imperative API is trivially adapted/shimmed to a declarative model (just saying :))

## How does it work?

In the "outside" DOM:

We propose a small extension to the Custom Elements `document.registerElement` 2nd param as currently defined (see: http://www.w3.org/TR/custom-elements/#extensions-to-document-interface-to-register):

```webidl
dictionary ElementRegistrationOptions {
     object? prototype = null;
     DOMString? extends = null;
     DOMString? url; // <--- new addition--async load from cross-domain
};

partial interface Document {
    Function registerElement(DOMString type, optional ElementRegistrationOptions options);
};
```

That's it. The outside DOM may create new element instances given the constructor function (or via the parser) and they will automatically inherit from the specified prototype (if provided). The "magic" of the provided url causes an API and element behavior to be asynchronously bound to the specified prototype and instances with its implementation hidden in an isolated scripting environment. Step-by-step:

1. The url refers to an HTML file whose script defines the custom element's prototype behavior, as well as monitoring the instance creation logic and attribute change notifications--all contained within a single new JS global scope that is fully isolated from the outside DOM.
  * Note: the parsed HTML of the cross-origin custom element is available via a document but is not rendered. Rendering the document would require associating it with a particular element which may not have happened yet. The URL is unrestricted--same-origin, cross-origin, it doesn't matter.
2. The fetched HTML file is executed in the context of a new JS global object, the `CustomElementGlobalScope`.
3. The JavaScript in the `CustomElementGlobalScope` registers any shared APIs for the Custom Element's prototype, and adds lifecycle callbacks for the management of instances that will be created based on this prototype. Additionally, the original parsed document may be cloned for use in populating a shadow DOM for any custom element instances (optional).

The script in the inner `CustomElementGlobalScope` interacts with the outer environment through three mechanisms: via events (both native user agent and self-synthesized), through APIs it causes to be created on the custom element's prototype object, and by way of the attributes of custom element instances.

### Events

Without a shadow DOM, events fire on the cross-origin custom element instances created in the inside DOM at the end of the event model's capture phase, and at the beginning of an event's bubble phase. No events capture/bubble to the `CustomElementGlobalScope`. If shadow DOMs are attached to these inside DOM custom element instances, they behave exactly like they would behave in the outside DOM.

For the purpose of isolation, a new nested event propagation is started on the inside DOM so that no data may be carried into the isolation boundary from outside DOM.

Events manually dispatched to custom elements on the inside DOM build up a nested dispatch path from the outside DOM to the inside DOM just like native event dispatches. This enables the custom element to be an event source if desired. 

### Prototype API management

When a cross-origin custom element is loaded, the user agent creates a mapping between the prototype supplied or created on the outside DOM with the custom element's global scope. This mapping is used to dynamically populate the prototype object provided on the outside DOM with APIs specified on the inside DOM. Note, that the custom element global scope never has direct access to the outside DOM prototype object, and the APIs that it causes to be defined on the outside prototype object are created within the realm of the outside DOM (the APIs appear to natively belong to the outside DOM).

The cross-origin custom element manages APIs on the outside prototype object using the following new methods of the custom element global scope:

* `setProperty(name, property_descriptor)` - mirroring `Object.defineProperty` for property creation
* `setProperties(multiple_property_descriptors)` - mirroring `Object.defineProperties` for convenience
* `deleteProperty(name)` - delete name;
* `getPropertyDescriptor(name)` - `Object.getOwnPropertyDescriptor` to test for existence or get the descriptor

### Explaining `setProperty` and related API creation methods

The user agent maintains a table of name-to-descriptor mappings for all names created/updated via the `setProperty` method. Each of the above APIs only operates on the table of known names (names defined on the outside prototype by the outside script engine are not seen/available via the above APIs.

The functions associated with the get, set, or value descriptors provided in the above calls are known as the "provider functions" (they provide the implementation). For each provider function in a descriptor, the user agent creates a new "marshalling function" and associates it with the provider functions. The lifetimes of these to functions are tied together.

A marshalling function is just a pass-through proxy to the provider function, except that it runs the structured clone algorithm on all its parameters and return values (this is what `postMessage` does to sanitize data between iframes).

The user agent replaces any provider functions with marshalling functions in the descriptor, optionally structure clones any non-provider function 'value' values, and then "defineProperty's" a new property with the provided name on the outside prototype.

*Note, once created, the custom element global scope can try to manage these APIs, but they are ultimately controlled by the outer DOM, and are at the mercy of what the outer DOM choses to do with them (including delete or move them).*

**Issue: describe how to handle name conflicts without exposing the fact that a particular named property might already exist on the prototype…?**

## Custom Element Instance management

Instance management (when new element instances go through their lifecycle model) is provided by a set of events similar (but not exactly the same as) how this is managed by "regular" custom element lifecycle callbacks. Instead of getting direct-references to the custom element instances however, the custom element global scope is given special "proxy" (not JS Proxies) objects so that read-only information can be gleaned from the instance. The proxy instance objects provide a minimal view of their corresponding outside Element object in order to add additional services if necessary. Such services include:

* inspection (readonly) of the values of the custom element's attributes.
* tools for extending the element with a shadow DOM document (full document)

**Issue: Async loading may mean that expected APIs are not immediately available for use on a custom element at creation time. Is there a mitigation for this? (Sync loading of the script? Event when the APIs are added?)**
	
## Proposed interfaces

The following is the "root" object used for the script parsed

```webidl
interface CustomElementPrototypeGlobalScope : EventTarget {
   readonly attribute CustomElementPrototypeGlobalScope self; // self-reference (like in Workers)
   readonly attribute WorkerLocation location; // This is defined in workers (gives href, etc.)

            attribute onerror; // For catching general script problems
  
   // Events for handling instance lifecycle management
            attribute oninstancecreated; // see custom elements: createdCallback (target is a CustomElementInstance)
            attribute oninstanceattached;
            attribute oninstancedetached;
};
// Also bring in: (without using WorkerUtils) navigator, document, timers, base64 utils
// Expose: DOMParser and XMLSerializer.
// All interfaces from DOM4 exposed (Document, Text, Range, etc.)

// API creation tools (these specifically do not take in arbitrary objects on which to operate
// they only work on the object implementing the interfaces they are implemented by...
[NoInterfaceObject]
interface MarshallingPropertyUtils {
   void setProperty(DOMString name, PropDesc definition); // add/change via propdesc.
   void setProperties(PropDescDictionary definitions);    // add/change via propdesc
   boolean deleteProperty(DOMString... names); // Remove 1..n registered properties.
   PropDescDictionary getPropertyDescriptor(DOMString name);
};
CustomElementPrototypeGlobalScope implements MarshallingPropertyUtils;
CustomElementInstance implements MarshallingPropertyUtils;

// Copied from ES5/6, in WebIDL format:
dictionary PropDesc {
   boolean configurable = false;
   boolean writable = false;
   boolean enumerable = false;
   any value;
   Function get;
   Function set;
};
dictionary PropDescDictionary {
   // any [set of] named PropDesc types
};

// To represent the element instances...
interface CustomElementInstance : EventTarget {
   // Attribute change handling
   readonly attribute AttrReadOnly[] attributes;
            attribute onattrset; // Event who's target is the AttrReadOnly…
            attribute onattrremoved; // ditto
            attribute onattrchanged; // ditto
   
   // Borrowed from ShadowDOM (extensions to Element interface):
   ShadowRoot createShadowRoot();
   readonly attribute ShadowRoot? shadowRoot;
};

Copied from DOM4, but without a read/write 'value':
interface AttrReadOnly {
  readonly attribute DOMString localName;
  readonly attribute DOMString value;

  readonly attribute DOMString name;
  readonly attribute DOMString? namespaceURI;
  readonly attribute DOMString? prefix;

  readonly attribute boolean specified; // useless; always returns true
};
```
