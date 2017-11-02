# HTML Template Instantiation
Proposed by Apple on November 1st, 2017.

## 1. Background

The HTML5 specification defines the [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element) but doesn't provide a native mechanism to instantiate it with some parts of it substituted, conditionally included, or repeated based on JavaScript values — as popular JavaScript frameworks such as [Ember.js](https://guides.emberjs.com/v2.16.0/templates/handlebars-basics/) and [Angular](https://angular.io/guide/template-syntax) allow. As a consequence, there are many incompatible template syntaxes and semantics to do substitution and conditionals within templates — making it hard for web developers to combine otherwise reusable components when they use different templating libraries.

Whilst previously we all decided to focus on shadow DOM and the custom-elements API first, we think the time is right — now that shadow DOM and custom-elements API have been shipping in Safari and Chrome and are in development in Firefox — to propose and standardize an API to instantiate HTML templates. We can make basic substitution work out of the box, and make it extensible for libraries and frameworks to innovate and iterate quickly. That would allow more interoperable behaviors across libraries and frameworks, and ultimately more reusable components.

For the sake of simplicity, we assume we adopt [mustache](https://en.wikipedia.org/wiki/Mustache_(template_system)) syntax in our standardized template language. We're open to adopting some other syntax but we would not want to make it configurable since we believe converging on a single syntax for parsing is a key to more interoperability.

## 2. Use Cases

Here are some of the use cases this API should address:

1. A component that represents an article should be able to create a shadow tree with `h1` and `article` elements from an HTML template without having to manually construct the DOM tree; e.g., the component may want to define its template as `<template><article><h1>{{title}}</h1></article></template>`, and instantiate its `content`.
2. A contact-card component should be able to stamp out the content’s name and email field with a value stored in a JS object easily; e.g., given a JavaScript object like `{name: "Ryosuke Niwa", email: "rniwa@webkit.org"}`,and a generic HTML template, it should be possible to generate a DOM tree like `<section><h1>Ryosuke Niwa</h1>Email: <a href="mailto:rniwa@webkit.org">rniwa@webkit.org</a></section>`.
3. A contact-card component should be able to update its shadow tree when the corresponding JS values such as name and email change; e.g., given the above template, we should be able to update “rniwa@webkit.org” with “rniwa@apple.com”, and "Ryosuke Niwa" with “rniwa”.
4. A JS library should be able to add the support for capitalizing text read off from the JavaScript object before it gets inserted into the template instance; e.g., `<template><article><h1>{{capitalize(title)}}</h1></article></template>`
5. A JS framework (e.g., Ember) should be able to use its own bidirectional binding mechanism to propagate the value back from the shadow tree to a contact-card component. If the email address was editable via an `input` element, for example, we would like to be able to update the object’s value to the newly-typed value, and then notify its observers in accordance with its bidirectional binding semantics; e.g. `<input value={{user.name}}>` to bind `user.name` with the value of the `input` element.
6. A search-field component should be able to show a checked checkbox when the user has already chosen to ignore case (capitalization) in the settings; e.g., when the `ignoreCase` property is `true`, it should generate `<input type="checkbox" checked>` and when the `ignoreCase` property is `false`, it should just generate `<input type="checkbox">` .
7. A search-field component should be able to show the fallback “Keywords” label when there is no custom placeholder specified.
8. A contact-card component shouldn’t show a label for an email address if the underlying JS object doesn’t have an email address specified; e.g., when the `email` property is missing from the input JavaScript object, show `<section><h1>Ryosuke Niwa</h1></section>` instead of `<section><h1>Ryosuke Niwa</h1>Email: <a href="mailto:"></a></section>.`
9. A contact list component should be able to use a single template to instantiate an array of contact—card components without having to instantiate each contact-card component separately.

## **3. Proposal**

To address all these use cases, we propose the following API.

### **3.1. Basics**

To address use cases (1), (2), and (3), we propose adding a `createInstance` method to the [`HTMLTemplateElement`](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element) interface. This new method clones the content tree of an HTML template element as an instance of `TemplateInstance`, which is a subclass of [`DocumentFragment`](https://dom.spec.whatwg.org/#interface-documentfragment). This new subclass has `update` method, which can re-substitute mustache syntaxes (we can pick some other syntax if anyone strongly feels about) in the cloned template instance.

```
[NoInterfaceObject]
interface TemplateInstance : DocumentFragment {
    void update(any state);
};

partial interface HTMLTemplateElement {
    TemplateInstance createInstance(optional any state);
};
```

Concretely, use case (1) is addressed by the component instancing a template as follows:

```
 // shadowRoot is the shadow root of a contact card component
 shadowRoot.appendChild(template.createInstance());
```

Use case (2) is addressed as follows:

```
// Template content is '`<section><h1>{{name}}</h1>Email: <a href="mailto:{{email}}">{{email}}</a></section>'`
shadowRoot.appendChild(template.createInstance({name: "Ryosuke Niwa", email: "[rniwa@webkit.org](mailto:rniwa@webkit.org)"}));
```

When `createInstance` is called with a JavaScript object, we automatically substitute every mustache syntax with the corresponding value of the property in the object. The resultant DOM would look as though we parsed the following HTML:

```
<section><h1>Ryosuke Niwa</h1>Email: <a href="mailto:rniwa@webkit.org”>rniwa@webkit.org</a></section>
```

For use case (3), `TemplateInstance`'s `update` method can be used as follows:

```
let content = template.createInstance({name: "Ryosuke Niwa", email: "[rniwa@webkit.org](mailto:rniwa@webkit.org)"});
shadowRoot.appendChild(content);
...
content.update({email: "[rniwa@apple.com](mailto:rniwa@apple.com)"});
```

That would update the DOM tree of the template instance to look like:

```
<section><h1>Ryosuke Niwa</h1>Email: <a href="mailto:rniwa@apple.com”>rniwa@`apple.com`</a></section>
```

Note that `TemplateInstance` keeps track of nodes via template parts defined in the next section so that even if they are removed from `TemplateInstance` per `appendChild` in the second line, they keep semantically functioning as a part of the template instance, making the subsequent `update` call possible.

Because multiple mustache syntaxes within a template work together to absorb various values of the state object, we don't support adding new mustache syntax or removing/adding updatable parts to an existing instance.

### 3.2. Template Parts and Custom Template Process Callback

In order to support use cases (4) and (5), let’s say we have the following `template` element:

```
<template id="foo"><div class="foo {{ f(y) }}">{{ x }} world</div></template>
```

For use case (4), we need some mechanism for author scripts to look at the original expression — such as `f(y)` — and *evaluate* it to some value as they see fit. A simple string substitution is possible but cumbersome in the case of calling `update` with a new JavaScript object, or when a library or a framework wants to inject non-text nodes.

For example, suppose a library wanted to provide an ability to auto-linkify a URL, with an icon indicating that the URL is an external website if the URL is not in the same domain. In order to do that, one has to generate a DOM tree equivalent to parsing `<a href="https://webkit.org">WebKit</a>` for the same domain but something like `<a href="https://webkit.org">WebKit</a> <img src="external-url.png">` for an external domain. In that scenario, the library has to keep track of where these nodes are inserted themselves, and replace them as needed upon calls to `TemplateInstance`'s `update` method.

Conceptually we need two objects, say *FY* and *X*, that represent `{{ f(y) }}` and `{{ x }}` which libraries and frameworks can use to read the original expression in each mustache, and use it to update the DOM. We call these objects **template parts**. Template parts should allow the inspection of content of `{{~}}` like so:

```
FY.expression; // Returns "f(y)"
X.expression; // Returns "x".
```

Template parts should allow the assignment of a new value after libraries and frameworks evaluated `f(y)` (here, assume `f(y)` evaluates to “bar” and `x` evaluates to “hello”:

```
FY.value = 'bar'; // Equivalent to div.setAttribute('foo bar').
X.value = 'hello'; // Equivalent to div.textContent = 'hello world’.
```

For template parts which appear as text nodes should also support taking multiple and arbitrary DOM nodes instead of just a text value:

```
// Insert span and a text node in place of {{ x }}.
X.replace([document.createElement('span'), 'hello']);
```

Or perhaps we would even want to parse HTML:

```
X.replaceHTML('<b>hello</b>');
```

For use case (5), we need to be able to inspect the attribute name of a template part as in:

```
FY.attributeName; // Returns "class"
```

The simplest approach to exposing these template parts is to expose them on `TemplateInstance`. However, template parts are typically used by authors of a new template syntax/feature (e.g., people who maintain libraries and frameworks), and not by the users of those syntax/features (e.g., people who use those libraries and frameworks).

To put it another way, in both use cases (4) and (5), creating an instance of a template shouldn't involve manually processing template parts. Furthermore, there should be a declarative mechanism to specify how template parts of a given template should be processed — since the semantics of template syntax don't typically change from one instance to another.

In fact, since the same template syntax extensions (e.g., Handleber template) tend to be used multiple times in the same document or in a given shadow tree of a component, it would be ideal if there were a mechanism to declare a **template type** once, and use it multiple times in a given document or a shadow tree. We don't want the template to directly specify a JS function because that would require polluting the global scope, and having an explicit template type registration opens a way in the future to scope template types registered per shadow tree. So we propose an addition of template type registry to document (and possibly shadow root).

Each template type is associated with a **template process callback** (`TemplateProcessCallback`). A template process callback is invoked inside each call to `createInstance` of `HTMLTemplate`, and takes there arguments: the newly created template instance, a sequence of template parts, and the state object passed into `createInstance`.

Each template part represents an occurrence of a mustache syntax in the template. When a mustache syntax appears as a text node, `NodeTemplatePart` is instantiated. If it appears within an attribute, `AttributeTemplatePart` is instantiated. Each template instance is associated with a template process callback used to create the instance. All subsequent calls to `update` invoke the same template process callback. Each template type is optionally associated with an **template create callback** (`TemplateProcessCallback`), which gets invoked when a template instance is initially constructed.

Consider, for example, the following template:

```
`<template type="my-template-type" id="contactTemplate">
    <section><h1>{{name}}</h1>Email: <a href="mailto:{{email}}">{{email}}</a></section>`
</template>
```

That template creates template parts: `NodeTemplatePart` for `{{name}}`, `AttributeTemplatePart` for `{{email}}` in the `href` attribute of the anchor element, and `NodeTemplatePart` for `{{email}}` for the occurrence inside the anchor element. In order to use this template, a template library or the page author would have had to define a `my-template-type` template type; e.g.:

```
document.defineTemplateType('my-template-type', {
    processCallback: function (instance, parts, state) {
        for (const part of parts)
            part.value = state[part.expression];
    }
});
```

This template process callback, for illustration purposes, is a simplified version of the **default template process callback**, which is used when the `type` content attribute is omitted on a `template` element. It goes through each template part (i.e., each occurrence of `{{ X }}`) and replaces it with the state object's value looked up by the template part's expression (e.g. `X` for `{{ X }}`). Once defined, this template process callback is invoked whenever the `createInstance` method is invoked on a `template` element of the type `my-template-type`; e.g.:

```
rniwa = {name: "R. Niwa", email: "rniwa@webkit.org"};
document.body.appendChild(contactTemplate.createInstance(rniwa);
```

The above code produces the same DOM as the following code under `document.body`:

```
document.body.innerHTML = '`<section><h1>R. Niwa</h1>Email:'
    + ' <a href="mailto:rniwa@webkit.org">rniwa@webkit.org</a></section>';`
```

Each template instance is associated with the template process callback used to create the instance, and all subsequent calls to `update`  go through the same callback with the same instance object and parts, but with a different state object.

It's possible for a single attribute to contain multiple `AttributeTemplatePart`s interleaved with other strings; e.g., `<div class="{{foo}} bar {{baz}}">`. In those cases, the values of all `AttributeTemplatePart` are concatenated with interleaving strings in the order they appear. For example, if the current value of `AttributeTemplatePart` for `{{foo}}` were “hello” and the setter of the value attribute on `AttributeTemplatePart` `{{baz}}` were called with the string “world”, the `class` attribute of the `div` is set to “hello bar world”.

Note that template parts are more like a range's [boundary points](https://dom.spec.whatwg.org/#concept-range-bp) than [nodes](https://dom.spec.whatwg.org/#concept-node) and don't appear in the DOM tree in the cloned template content. Think of these properties as sort of Position / RangeBoundaryPoint. They're there to remember where this part belongs. When a DOM tree is mutated, they continue to function as long as the parent node and next or previous siblings at where the template part was instantiated are still there.

We allow inserting and removing preceding siblings and succeeding siblings in some cases. See the section 4 for more details.

Let's suppose we wanted to create a template type which remembers the state object being passed when it was created, and automatically updates the instance whenever property values are changed at some checkpoints (e.g., at the next `requestAnimationFrame`). We can implement this using a template create callback as follows:

```
document.defineTemplateType('self-updating-template', {
    createCallback: function (instance, parts, state) {
        onCheckPoint(() => instance.update(state));
    },
    processCallback: function (instance, parts, state) {            
        for (const part of parts)
            part.value = state[part.expression];
    },
});
```

Here, `onCheckPoint` is an imaginary helper function which invokes the specified callback at some checkpoints (e.g., whenever rAF occurs; if we had [Object.observe](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe), we could have been able to use that to automatically update whenever property values of `state` object had changed). In this example, the template process callback is invoked with the same `state` object used to create the instance whenever `update` is called on `TemplateInstance`. Users of this template no longer have to call `update` on `TemplateInstance` manually, since it gets automatically updated whenever checkpoints occur.

Since each template instance is associated with a specific template type and thereby a specific process callback, there is no asynchronous definition. Each template type must be defined at the time a template of the type is instantiated. Otherwise, the fallback to the default template type and the default template process callback is used.

More formally, the following partial interfaces, interfaces, and callbacks are introduced:

```
interface HTMLTemplateElement {
    attribute DOMString type;
};

callback TemplateProcessCallback = void (TemplateInstance, sequence<TemplatePart>, any state);

dictionary TemplateTypeInit {
    TemplateProcessCallback processCallback;
    TemplateProcessCallback? createCallback;
};

partial interface Document {
    void defineTemplateType(DOMString type, TemplateTypeInit typeInit);
};

interface TemplatePart {
    readonly attribute DOMString expression;
    attribute DOMString? value;
    stringifier;
};

interface AttributeTemplatePart : TemplatePart {
    readonly attribute Element element;
    readonly attribute DOMString attributeName;
    readonly attribute DOMString attributeNamespace;
    attribute boolean booleanValue;
};

interface NodeTemplatePart : TemplatePart {
    readonly attribute ContainerNode parentNode;
    readonly attribute Node? previousSibling;
    readonly attribute Node? nextSibling;
    [NewObject] readonly NodeList replacementNodes;
    void replace((Node or DOMString)... nodes);
    void replaceHTML(DOMString html);
};
```

`TemplatePart` is the base class of template parts. `expression` returns the string inside `{{ ~ }}` after stripping the leading and trailing whitespace. The `value` getter returns the string value set by the template process callback on getting, and the `value` setter updates the attribute value for `AttributeTemplatePart`. For `NodeTemplatePart`, the `value` getter returns the concatenation of the `textContent` of the nodes inserted into the part, and the `value` setter replaces the nodes of the part by a single text node with the new value.

`AttributeTemplatePart` has IDL attributes for its associated element and attribute. In order to support use case (6), removing or adding an attribute based on a JavaScript property, the setter of a `booleanValue` attribute of `AttributeTemplatePart` calls `part.element.setAttribute(part.name, "")` when the value is strictly equal to `true` and calls `part.element.removeAttribute(part.name)` when it's `false`, if the template part is solely controlled by a single template part. See section 4 for more details.

`NodeTemplatePart` has a `parentNode` attribute to return the node under which `{{ ~ }}` appeared, and `previousSibling` and `nextSibling` for siblings around it. When a single text node contains multiple `{{ ~ }}`, these nodes’ `previousSibling` and `nextSibling` may refer to nodes in the preceding or the succeeding part. In addition to setting a string value, `NodeTemplatePart` provides a way to insert DOM nodes directly with `replace` and `replaceHTML` methods.

In the default template process callback, the fallback or default value of a template part, use case (7), is specified by `||` syntax as done idiomatically in JavaScript; e.g., `<div class="{{ foo || bar || 'X' }} baz" empty="{{ nullable || '' }}"></div>`. We also propose to support *path syntax* in the default process callback as in: `<div bar={{ attrs.foo }}>`.

Note that with this approach, we have an option to address the need to [declaratively instantiate a shadow tree](https://github.com/whatwg/dom/issues/510) by adding a new callback which gets called for each appearance of a template element as follows if we so desired:

```
<template type="shadow-root">~</template>
<script>
document.defineTemplateType("shadow-root", {
    declareCallback: (template) => {
        const shadowRoot = template.parentElement.attachShadow({mode: template.getAttribute('shadow-mode')});
        shadowRoot.appendChild(template.instantiate());
        template.remove();
    }
});
</script>
```

Note that we don't intend to natively support bidirectional bindings or even automatic updates of a DOM tree when the corresponding JavaScript is mutated. With approaches taken in libraries like React, it's not necessarily desirable or useful to monitor mutations on a JavaScript object, because some communities of JS developers are embracing functional programming approach with immutable objects.

In addition, in order to build a two-way binding, we would have to monitor JS properties and other DOM events manually on each element. For example, the `input` element's `value` attribute never changes when the user types in text. Instead, we would have to monitor the dirty value of the input element, and reflect that change back at the time of the change, when the `input` event fires. We didn't want to codify all these edge cases for each HTML element, at least in the initial version of this API. We're open to adding such capabilities in  future versions of the default template process callback — probably as a new UA-defined template type.

### 3.3. Conditionals and Loops using Nested Templates

With API proposed thus far, conditional statements for use case (8) can be implemented by libraries and frameworks since they can inspect the value of expression on a template part. e.g. to support handlebar style conditionals, a template process callback could detect `{{if x}}` and ignore the rest of the template all the way up (as well as nested if's) until the next `{{/if}}` when x is `false`.

However, this approach won't work for use case (9). To see why, suppose we had the following template:

```
<template type="with-for-each" id="list">
    <ul>
    {{foreach items}}
        <li class={{class}} data-value={{value}}>{{label}}</li>
    {{/foreach}}
    </ul>
</template>
```

We can detect `{{foreach items}}` the same way we detect `{{if x}}`, but we there is exactly one template part object for `{{class}}`, `{{value}}`, and `{{label}}`, not per an element in items, and the browser engine doesn't have a way of ignoring out how many parts are needed unless we standardized the exact semantics foreach:

```
document.defineTemplateType('with-for-each', { processCallback: (instance, parts, state) => {
    for (const part of parts) {
        ...
        const tokens = part.expression.split(' ');
        if (tokens[0] == 'foreach') {
            const propertyName = tokens[1];
            for (const item of state[propertyName]) {
                // BUT how do we figure out how many parts are needed for: class, value, and label?
            }
        }
        ...
    }
}
list.createInstance({items: [{class: 'baz', value: 'baz', label: 'hello world'}]});
```

In fact, when `update` method of `TemplateInstance` is subsequently called, we might need to create more template parts and remove some since the number of elements in the array for looping (“items” in this case) can change from one update to another.

As suggested by others in the past discussions, we propose to use nested templates for these cases:

```
<template type="with-for-each" id="list">
    <ul>
        <template directive="foreach" expression="items">
            <li class={{class}} data-value={{value}}>{{label}}</li>
        </template>
    </ul>
</template>
```

In this approach, each inner template appear as its own template part, and the template process callback which supports foreach **directive** would instantiate the inner template as many times as needed as follows:

```
document.defineTemplateType("with-for-each", { processCallback: function (instance, parts, state) {
    for (const part of parts) {
        ...
    }
    for (const template of instance.querySelectorAll("template")) {
        ...
        if (template.directive == "foreach")
            template.parentNode.replaceChild(template, template.createInstance(state[template.expression]));
    }
}});
```

However, replacing the inner template elements in its instance becomes problematic when `update` method is subsequently called. This would mean that the template process callback must keep track of the location at which this substitution had occurred as well as the original inner template.

To make this process more streamlined, we propose treating inner template elements as parts, and introduce  `InnerTemplatePart` interface as follows:

```
 InnerTemplatePart : NodeTemplatePart {
    HTMLTemplateElement template;
    attribute DOMString directive;
};
```

With this interface, the template process callback that implements foreach and other kinds of looping constructs could simply call `replace` with newly constructed elements as follows:

```
document.defineTemplateType("with-for-each", {
    processCallback: function (instance, parts, state) {
        for (const part of parts) {
            if (part instanceof InnerTemplatePart) {
                switch (part.directive) {
                case "foreach":
                    part.replace(state[part.exression].map(item => part.template.createInstance(item)));
                    break;
                }
            }
        }
    }
});
```

> Note: a well defined template library should implement array-diff'ing algorithm to reduce the node construction & destruction churn. We could built such a diff'ing algorithm into the default template process callback as well.


There is an alternative approach for (9), which is to make TemplatePart constructible from template process callback themselves. However, this approach involves the template process callback cloning template parts along with other nodes, or let author scripts manually specify to which element each template part belongs. This quickly becomes an entangled mess because now we could have multiple template parts that refer to a single DOM location or an attribute, and we have to start dealing with multiple template parts trying to override one another even though there is no good use case for such a behavior.

We like the idea of supporting very basic control flow such as `if` and `foreach` in the default template process callback but we don't think it's a show stopper if the default template process callback didn't support them in the initial cut.


> Note: We're open to changing the name of `InnerTemplatePart`. Other names we've considered are: `TemplateTemplatePart`, `TemplateElementTemplatePart`, and `NestedTemplatePart`.

## 4. Definitions and Algorithm for Template Parts

This section defines partial specifications for template parts and how they're instantiated. It's meant to read like a real W3C/WHATWG specifications. All text is normative unless otherwise specified. Due to the limitation of markdown syntax, each concept “to X” defined within this specification is explicitly referred to as “the concept to X”.

Each template element has an associated `TemplateProcessCallback` either the one specified by `type` content attribute or of the default template process callback if the content attribute is not specified.

### 4.1. Attribute value setter

When an [attribute](https://dom.spec.whatwg.org/#concept-attribute) is fully controlled by a single _attribute template part_, the attribute is said to be **fully templatized**. When an [attribute value](https://dom.spec.whatwg.org/#concept-attribute-value) consists of a concatenation of strings and _attribute template parts_, it is said to be **partially templatized**. Similarly, when contents of a [Text](https://dom.spec.whatwg.org/#text) [node](https://dom.spec.whatwg.org/#concept-node) is fully controlled by a single _node template part_, it is said to be _fully templatized_ and _partially tempatized_ otherwise.

An **attribute value setter** is an object used to aggregate values of _attribute template parts_ and strings in a given attribute. It has an associated [element](https://dom.spec.whatwg.org/#concept-element), an associated [attribute](https://dom.spec.whatwg.org/#concept-attribute), an associated **attribute template part list**, which is a list of strings and _attribute template parts_. When the _attribute template part list_ of an attribute consists of exactly one attribute template part, it is _fully templatized_. Each _attribute template part_ has an associated _attribute value setter_ and a value string.

### 4.2. Node Value Setter

A **node value setter** is an object used to aggravate values of _node template parts_ and strings in a given [Text](https://dom.spec.whatwg.org/#text) [node](https://dom.spec.whatwg.org/#concept-node). it has an associated [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [node](https://dom.spec.whatwg.org/#concept-node), a [previous sibling](https://dom.spec.whatwg.org/#concept-tree-previous-sibling), a [next sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling), a boolean **fully templatized** flag, a **previous replacement nodes**, which is a list of node most recently inserted into the Dom tree, and an associated **node template part list**, which is a list of [nodes](https://dom.spec.whatwg.org/#concept-node) and _node template parts_. When the _fully templatized flag_ is set, _node template part list_ is said to be _fully templatized_. Otherwise, it is said to be _partially templatized_.  A _node value setter_ can also be in a **detached state** in which case the _node setter value_ would fail to apply its _node template part list_ to the _template instance_. Each _node template part_ has an associated _node value setter_ and a list of Node's called **replacement node list**, which is a list of nodes currently being placed or controlled by the _node template part_ in the template instance.

An **inner template part** has an associated [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element) in addition to a _replacement node list_ and an _node value setter_.


> Note: _attribute value setter_ and _node value setter_ are specifications phantoms that do not need to exist in actual implementations.

### 4.3 Creating Template Parts

The  `createInstance(optional any state)` method on `HTMLTemplateElement`, when invoked, must run the following steps: 

1. Let *clonedTree* be the result of [cloning](https://dom.spec.whatwg.org/#concept-node-clone) with [the ](https://dom.spec.whatwg.org/#concept-node-clone)[template contents](https://html.spec.whatwg.org/multipage/scripting.html#template-contents) and the *clone children flag* set.
2. Let *instance* be an instance of `TemplateInstance`.
3. [Append](https://dom.spec.whatwg.org/#concept-node-append) *clonedTree* to *instance*.
4. Let *parts* be an empty list.
5. For every [descendent](https://dom.spec.whatwg.org/#concept-tree-descendant) node c*urrentNode* of *instance* in [tree order](https://dom.spec.whatwg.org/#concept-tree-order), run these steps:
    1. If c*urr**entNode* is a [template element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element):
        1. Run the concept to _adjust single node case_ with *currentNode***.**
        2. Let *nodeValueSetter* be a new instance of the _node value setter_ with *currentNode*, the [previous sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of *currentNode*, the [next sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of *currentNode*, an empty _previous replacement nodes_, fully templatized set to the result of running the concept to _determine full templatizability_ with *currentNode*, and an empty _node template part list_.
        3. Let *innerPart* be a new instance of `InnerTemplatePart` associated with *currentNode*, an empty _replacement node list_, and *nodeValueSetter*.
        4. Append *innerPart* to the end of *parts.*
        5. [Remove](https://dom.spec.whatwg.org/#concept-node-remove) *currentNode* from the *currentNode*'s [parent](https://dom.spec.whatwg.org/#concept-tree-parent).
        6. Run the concept to _apply node template part list_ with *nodeValueSetter*.
    2. Otherwise, if *currentNode* is an [element](https://dom.spec.whatwg.org/#concept-element), for every [attribute](https://dom.spec.whatwg.org/#concept-attribute) in the [attribute list](https://dom.spec.whatwg.org/#concept-element-attribute) of *currentNode*:
        1. Let *value* be the [attribute value](https://dom.spec.whatwg.org/#concept-attribute-value) after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace).
        2. Let *tokens* to be the result of running the concept to _parse a template string_ on *value*.
        3. If *tokens* contains exactly one string, abort the rest of steps and go to the next node.
        4. Let *attributeValueSetter* be a new instance of the _attribute value setter_ with *currentNode*, the current attribute, and an empty _attribute template part list_.
        5. For every *token* in *tokens*:
            1. If the type of *token* is “string”,
                1. Append the string to end of the _attribute template part list_*.*
            2. Otherwise (if *token* is of the type “pair”),
                1. Let *attributePart* be a new instance of `AttributeTemplatePart` with *attributeValueSetter* and null string.
                2. Append *attributePart* to the end of the _attribute template part list_.
                3. Append *attributePart* to the end of *parts*.
        6. Run the concept to _apply attribute template part list_ with *nodeValueSetter*.
    3. If *currentNode* is a [Text](https://dom.spec.whatwg.org/#text) [node](https://dom.spec.whatwg.org/#concept-node):
        1. Let *value* be *currentNode*'s [data](https://dom.spec.whatwg.org/#concept-cd-data) after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace).
        2. Let *tokens* to be the result of running the concept to _parse a template string_ on *value*.
        3. If *tokens* contains exactly one string, abort the rest of steps and go to the next node.
        4. Run the concept to _adjust single node case_ with *currentNode***.**
        5. Let *nodeValueSetter* be a new instance of the _node value setter_ with the [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [node](https://dom.spec.whatwg.org/#concept-node) of c*urrentNode*, the [previous sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of *currentNode*, an empty _previous replacement nodes_, fully templatized flag set to the result of running the concept to _determine full templatizability_ with *currentNode*, and an empty _node template part list_.
        6. For every *token* in *tokens*:
            1. If the type of *token* is “string”,
                1. Let *text* be a new [Text](https://dom.spec.whatwg.org/#text) [node](https://dom.spec.whatwg.org/#concept-node) with the string of the pair as the [data](https://dom.spec.whatwg.org/#concept-cd-data).
                2. Append *text* to end of _node template part list_ of *nodeValueSetter*.
            2. Otherwise (if *token* is of the type “part”),
                1. Let *nodePart* be a new instance of `NodeTemplatePart` with *nodeValueSetter* and an empty _replacement node list_.
                2. Append *nodePart* to end of _node template part list_ of *nodeValueSetter*.
                3. Append *nodePart* to the end of *parts*.
        7. [Remove](https://dom.spec.whatwg.org/#concept-node-remove) *currentNode* from the *currentNode*'s [parent](https://dom.spec.whatwg.org/#concept-tree-parent).
        8. Run the concept to _apply node template part list_ with *nodeValueSetter*.
6. Let *partArray* be be ! [ArrayCreate](https://tc39.github.io/ecma262/#sec-arraycreate)(0).
7. Let *partsLength* be the result of performing [ArrayAccumulation](https://tc39.github.io/ecma262/#sec-runtime-semantics-arrayaccumulation) for Parts with arguments *partsArray* and 0.
8. If the previous step resulted in [abrupt completion](https://tc39.github.io/ecma262/#sec-completion-record-specification-type), return null.
9. If there is a _template create callback_ associated with the context object:
    1. Let *createCallback* be `TemplateProcessCallback` associated with the context object.
    2. Invoke [[[Call]]](https://tc39.github.io/ecma262/#sec-ecmascript-function-objects-call-thisargument-argumentslist) internal method of *createCallback* with *instance*, *partArray*, and *state*.
    3. If the previous step resulted in [abrupt completion](https://tc39.github.io/ecma262/#sec-completion-record-specification-type), return null.
10. Let *processCallback* be the template process callback associated with the context object.
11. Invoke [[[Call]]](https://tc39.github.io/ecma262/#sec-ecmascript-function-objects-call-thisargument-argumentslist) internal method of *processCallback* with *instance*, *partArray*, and *state*.
12. If the previous step resulted in [abrupt completion](https://tc39.github.io/ecma262/#sec-completion-record-specification-type), return null.
13. Return *instance*.

> Note: We run the concepts to _apply attribute template part list_ and _apply node template part list_ immediately to strip away the mustache syntax in the original template as well as whitespaces before & after it to keep the initial template state consistent with the one after running these concepts in a template process callback. Actual implementations can run these algorithm as it clones the tree, and avoid unnecessary churn of text nodes and strings as an optimization.

When there is exactly one `{{~}}` inside a template, we keep 


To **parse a template string** with a DOMString *template*, run these steps:

1. Let *position* be a [position variable](https://infra.spec.whatwg.org/#string-position-variable) for *template*, initially pointing at the start of* template.*
2. Let *state* be “initial”.
3. Let *beginningPosition* be *position*.
4. Let *lastCodePoint* be U+0000 NULL.
5. Let *tokens* be a list of pairs consisting of a type which takes a value of “string” or “part” and a [string](https://infra.spec.whatwg.org/#string).
6. While *position* is not past the end of input:
    1. If *state* is “initial” and the code point is U+007B LEFT CURLY BRACKET and *lastCodePoint* is not U+005C REVERSE SOLIDUS,
        1. Let *state* be “beginCurly”
        2. Let *candidateEndingPosition* be *position*.
        3. Go to step 6.e.
    2. If *state* is “*beginCurly*”,
        1.  If the code point is U+007B LEFT CURLY BRACKET and *lastCodePoint* is not U+005C REVERSE SOLIDUS,
            1. Let *state* be “part”.
            2. Append the pair of the type “string” and the code points starting at *beginningPosition* and ending immediately before *candidateEndingPosition* to the end of *tokens.*
            3. Let *beginningPosition* be the next code point in *template.*
        2. Otherwise,
            1. Let *state* be “initial”.
        3. Got to step 6.e.
    3. If *state* is “part” and the code point is U+007D RIGHT CURLY BRACKET and *lastCodePoint* is not U+005C REVERSE SOLIDUS,
        1. Let state be “endCurly”.
        2. Let *candidateEndingPosition* be *position*.
        3. Go to step 6.e.
    4. If state is “endCurly” and the code point is U+007D RIGHT CURLY BRACKET,
        1. If the code point is U+007D RIGHT CURLY BRACKET and *lastCodePoint* is not U+005C REVERSE SOLIDUS,
            1. Let *state* be “initial”.
            2. Let *expression* be the code points starting at *beginningPosition* and ending immediately before *candidateEndingPosition*.
            3. [Strip leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace) from expression.
            4. Append the pair of type “pair” and *expression* to the end of *tokens.*
        2. Otherwise,
            1. Let *state* be “part”.
        3. Go to step 6.e.
    5. Let *lastCodePoint* be the current code point if *lastCodePoint* is not U+005C REVERSE SOLIDUS. Otherwise let *lastCodePoint* be U+0000 NULL.
    6. Advance *position* to the next [code point](https://infra.spec.whatwg.org/#code-point) in *template*.
7. Return *tokens*.

> Note: This algorithm supports escaping `{` with `\` and `\` with `\`. We're open to using alternate syntax like `${~}` and `{~}` in place of the mustache syntax `{{~}}`, and or not supporting these escaping characters.


To **adjust single node case** with *node*, run these steps:

1. Let *parent* be the  [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [node](https://dom.spec.whatwg.org/#concept-node) of *node.*
2. If *parent* is an instance of `TemplateInstance` and *node* does not have any [sibling](https://dom.spec.whatwg.org/#concept-tree-sibling):
    1. Let *emptyText* be a new `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node) with its [data](https://dom.spec.whatwg.org/#concept-cd-data) set to an empty string and [node document](https://dom.spec.whatwg.org/#concept-node-document) set to *currentNode*'s associated [node document](https://dom.spec.whatwg.org/#concept-node-document).
    2. [Insert](https://dom.spec.whatwg.org/#concept-node-insert) *emptyText* into *parent* before *node*.

> Note: This algorithm is needed when there is exactly one template element surrounded by text nodes or a single `{{~}}` inside a template. In those cases, we need some node to anchor _node value setter_ other than text node / template element itself.


To **determine full templatizability** of a node *node*, run these steps:

1. Let *parent* be *node*'s [parent](https://dom.spec.whatwg.org/#concept-tree-parent).
2. If *parent* is an instance of `TemplateInstance`, return false.
3. Let *child* be the [first child](https://dom.spec.whatwg.org/#concept-tree-first-child) of *parent*.
4. While *child* is not null:
    1. If *child* is not *node:*
        1. If *child* is not `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node), return false.
        2. If *child*'s [data](https://dom.spec.whatwg.org/#concept-cd-data) contains anything but [ASCII whitespace](https://infra.spec.whatwg.org/#split-on-ascii-whitespace), return false.
    2. Let *child* be the [next sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of *child*.
5. Return true.

> Note: This algorithm returns true when *node* is the sole child of its parent ignoring text nodes that only contain whitespace at the beginning and the end of the parent node.

### 4.4. `TemplatePart` Interface

The abstract superclass `TemplatePart` defines two IDL attributes: `expression`, `value`, and the stringifier.

The  `expression` readonly attribute must, on getting, return the string inside the mustache syntax with [leading and trailing ASCII whitespace stripped](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace).

The definition of `value` IDL attribute depends on the concrete subclass of `TemplatePart.`

The stringifier of `TemplatePart` is an alias to the `value` attribute's getter.

### 4.5 `AttributeTemplatePart` Interface

`AttributeTemplatePart` interface has four IDL attributes: `element`, `attributeName`, `attributeNamespace`, and `booleanValue` in addition the ones inherited from `TemplatePart`.

The `element` readonly IDL attribute, on getting, must return the associated [element](https://dom.spec.whatwg.org/#concept-attribute-element) of the _attribute value setter_ associated with the context object.

The `attributeName` readonly IDL attribute, on getting, must return the [qualified name](https://dom.spec.whatwg.org/#concept-attribute-qualified-name) of the _attribute value setter_ associated with the context object..

The `attributeNamespace` readonly IDL attribute, on getting, must return the [namespace](https://dom.spec.whatwg.org/#concept-attribute-namespace) of the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) of the  _attribute value setter_ associated with the context object.

The `value` IDL attribute of `TemplatePart` when involved on an _attribute template part_, on getting, must return the value string of the _attribute template part_ if the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) of the _attribute value setter_ associated with the context object if the attribute is _partially templatized_. Otherwise, if the [attribute](https://dom.spec.whatwg.org/#concept-attribute) is _fully templatized_, it must return its [attribute value](https://dom.spec.whatwg.org/#concept-attribute-value). On setting, it must set the value string of the _attribute template part_ to the new value, and _apply attribute template part list_ with the _attribute template part_ associated with the context object.

The `booleanValue` IDL attribute, on getting, must return `true` if the associated [element](https://dom.spec.whatwg.org/#concept-attribute-element) of the _attribute value setter_ associated with the context object has the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) of the _attribute value setter_ and return `false` otherwise. On setting, if the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) is _fully templatized_, it must set the string value to an empty string “”, and _apply attribute template part list_ with the _attribute template part_ associated with the context object. Otherwise, if the [attribute](https://dom.spec.whatwg.org/#concept-attribute) is _partially templatized_, it must throw a “[`NotSupportedError`](https://heycam.github.io/webidl/#notsupportederror)” [`DOMException`](https://heycam.github.io/webidl/#idl-DOMException).

To **update** the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) of an _attribute value setter_ *attributeValueSetter* to an *attribute*, run these steps:

1. Remove the current associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) from the associated [element](https://dom.spec.whatwg.org/#concept-attribute-element).
2. Change the associated [attribute](https://dom.spec.whatwg.org/#concept-attribute) of *attributeValueSetter* to *attribute*.
3. Run the concept to _apply attribute template part list_ with *attributeValueSetter*.

> Note: In the current proposal, updating `attributeName` or `attributeNamespace` would result in updating the attribute twice when changing both. We could instead make these IDL attributes readonly, and add a method which updates the associated attribute instead.


To **apply attribute template part list** with an _attribute value setter_ *attributeValueSetter*, run these steps:

1. Let *partList* be the *_attribute template part list_* of *attributeValueSetter*.
2. If *partList* contains exactly one _attribute template part_ (this is the fully templatized case):
    1. Let *fullTemplate* be the _attribute template part_ in *tokenList*.
    2. If the value string of *fullTemplate* is null, [remove an attribute](https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-namespace) with the namespace of the associated attribute of *attributeValueSetter*, the [local name](https://dom.spec.whatwg.org/#concept-attribute-local-name) of the associated attribute of *attributeValueSetter*, and the associated element of *attributeValueSetter.*
    3. Otherwise (if the value string of *fullTemplate* is not null*)*, invoke [setAttributeNS](https://dom.spec.whatwg.org/#dom-element-setattributens) with the namespace of the associated attribute of *attributeValueSetter*, the [qualified name](https://dom.spec.whatwg.org/#concept-attribute-qualified-name) of the associated attribute of *attributeValueSetter*, and the value string of *attributeValueSetter* on the associated element of *attributeValueSetter.*
3. Otherwise:
    1. Let *newValue* be an empty string.
    2. For each *part* in *partList*:
        1. If *part* is a “string”, append the string to the end of *newValue*.
        2. Otherwise (*part* is an _attribute template part_), append the value string of *part* to the end of *newValue*.
    3. Invoke [setAttributeNS](https://dom.spec.whatwg.org/#dom-element-setattributens) with the namespace of the associated attribute of *attributeValueSetter*, the [qualified name](https://dom.spec.whatwg.org/#concept-attribute-qualified-name) of the associated attribute of *attributeValueSetter*, and *newValue* on the associated element of *attributeValueSetter.*

> Note: Only fully templatized attribute can be removed in the current proposal. An attribute template part never fails to update unlike a node template part which can fail to apply changes in some cases.

### 4.6 `NodeTemplatePart` Interface

`NodeTemplatePart` interface has four additional attributes: `parentNode`, `previousSibling`, `nextSibling`, `replacementNodes`, and two methods: `replace` and `replaceHTML` in addition to the ones inherited from `TemplatePart`.

The `parentNode` is a readonly IDL attribute, which on getting must return the parent node of the _node value setter_ associated with the context object.

The `previousSibling` is a readonly IDL attribute on getting must run these steps:

1. Let *nodeValueSetter* be the _node value setter_ associated with the context object.
2. Let *partList* be _node template part list_ of *nodeValueSetter*.
3. If the context object is the first item in *partList*, return the previous sibling of *nodeValueSetter* and abort these steps.
4. Let *previousPart* be an item in *partList* immediately before the context context.
5. While *previousPart* is not null:
    1. If *previousPart* is a `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node), return *previousPart* and abort these steps.
    2. Otherwise (*previousPart* is another _node template part_):
        1. If the _replacement nodes_ of *previousPart* is not empty, return the last node in the _replacement nodes_ and abort these steps.
    3. Let *previousPart* be the item immediately before *previousPart* in *partList*.
6. Return null.


The `nextSibling` is a readonly IDL attribute on getting must run these steps:

1. Let *nodeValueSetter* be the _node value setter_ associated with the context object.
2. Let *partList* be _node template part list_ of *nodeValueSetter*.
3. If the context object is the last item in *partList*, return the next sibling of *nodeValueSetter* and abort these steps.
4. Let *nextPart* be an item in *partList* immediately after the context context.
5. While *nextPart* is not null:
    1. If *nextPart* is a `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node), return *nextPart* and abort these steps.
    2. Otherwise (*nextPart* is another _node template part_):
        1. If the _replacement nodes_ of *nextPart* is not empty, return the first node in the _replacement nodes_ and abort these steps.
    3. Let *nextPart* be the item immediately after *nextPart* in *partList*.
6. Return null.


The `replacementNodes` is a readonly IDL attribute, which on getting must return the _replacement nodes_ of the context object.

The `value` IDL attribute of `TemplatePart` when involved on a _node template part_, on getting, must run these steps:

1. Let *value* be an empty string.
2. For every *node* in the _replacement nodes_ of the context object:
    1. Append the result of invoking [textContent](https://dom.spec.whatwg.org/#dom-node-textcontent) to *value*.
3. Return *value*.

On setting, it must run these steps:

1. If the _replacement nodes_ consists of exactly one `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node):
    1. Let *text* be the `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node) in _replacement nodes._
    2. [Replace data](https://dom.spec.whatwg.org/#concept-cd-replace) with *text*, offset 0, count text's [length](https://dom.spec.whatwg.org/#concept-node-length), and data new value.
2. Otherwise:
    1. Let *text* be a new `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node) with its [data](https://dom.spec.whatwg.org/#concept-cd-data) set to new value and [node document](https://dom.spec.whatwg.org/#concept-node-document) set to *parentNode*'s associated [node document](https://dom.spec.whatwg.org/#concept-node-document).
    2. Remove all nodes from the _replacement nodes_, and insert *text*.
3. Run the concept to _apply node template part list_ with the _node value setter_ associated with the context object.

The `replace(nodes)` method, when involved, must run these steps:

1. Replace each string in *nodes* with a new `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node) whose [data](https://dom.spec.whatwg.org/#concept-cd-data) is the string and [node document](https://dom.spec.whatwg.org/#concept-node-document) is document.
2. If any node in *nodes* is a `[Document](https://dom.spec.whatwg.org/#document)`, `[DocumentType](https://dom.spec.whatwg.org/#documenttype)`, or `[DocumentFragment](https://dom.spec.whatwg.org/#documentfragment)` [node](https://dom.spec.whatwg.org/#concept-node), then [throw](https://heycam.github.io/webidl/#dfn-throw) an "`[InvalidNodeTypeError](https://heycam.github.io/webidl/#invalidnodetypeerror)`" `[DOMException](https://heycam.github.io/webidl/#idl-DOMException)`.
3. Remove all nodes from the _replacement nodes_, and insert *nodes*.
4. Run the concept to _apply node template part_ list with the node value setter associated with the context object.

The `replaceHTML(html)` method, when involved, must run these steps:

1. Let *fragment* be the result of invoking the [fragment parsing algorithm](https://w3c.github.io/DOM-Parsing/#dfn-fragment-parsing-algorithm) with *html* as markup, and the parent node of the _node value setter_ associated with the context object as the context element.
2. Let nodes be *nodes* be [children](https://dom.spec.whatwg.org/#concept-tree-child) of *fragment*.
3. Remove all nodes from the _replacement nodes_, and insert *nodes*.
4. Run the concept to _apply node template part list_ with the node value setter associated with the context object.

```
[NoInterfaceObject]
interface NodeTemplatePart : TemplatePart {
    readonly attribute ContainerNode parentNode;
    readonly attribute Node? previousSibling;
    readonly attribute Node? nextSibling;
    [NewObject] readonly NodeList replacementNodes;
    void replace((Node or DOMString)... nodes);
    void replaceHTML(DOMString html);
};
```

To **apply node template part list** with *nodeValueSetter***,** run these steps:

1. Let *partList* be the _node template part list_ of *nodeValueSetter*.
2. Let *nodes* be an empty [node](https://dom.spec.whatwg.org/#concept-node) list.
3. For every *part* in *partList*:
    1. If *part* is a `[Text](https://dom.spec.whatwg.org/#text)` [node](https://dom.spec.whatwg.org/#concept-node), append *text* to *nodes*.
    2. Otherwise (*part* is a _node template part_), add every node in the _replacement nodes_ of *part* to *nodes*.
4. Let *referenceNode* be null.
5. If *nodeValueSetter*'s fully templatized flag is set:
    1. [Remove](https://dom.spec.whatwg.org/#concept-node-remove) all *parent*’s [children](https://dom.spec.whatwg.org/#concept-tree-child), in [tree order](https://dom.spec.whatwg.org/#concept-tree-order), with the *suppress observers flag* unset.
6. Otherwise (*nodeValueSetter*'s _fully templatized flag_ is not set):
    1. If the [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [nodes](https://dom.spec.whatwg.org/#concept-node) of the previous sibling and the next sibling associated with *nodeValueSetter* is different from the parent node associated with *nodeValueSetter*:
        1. If [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [nodes](https://dom.spec.whatwg.org/#concept-node) of the previous sibling associated with *nodeValueSetter* and the last node in the _previous replacement nodes_ are same as the parent node associated with *nodeValueSetter*, set the next sibling of *nodeValueSetter* to the [next sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of the last node in the _previous replacement nodes_.
        2. If [parent](https://dom.spec.whatwg.org/#concept-tree-parent) [nodes](https://dom.spec.whatwg.org/#concept-node) of the next sibling associated with *nodeValueSetter* and the first node in the _previous replacement nodes_ are same as the parent node associated with *nodeValueSetter*, set the previous sibling of *nodeValueSetter* to the [previous sibling](https://dom.spec.whatwg.org/#concept-tree-previous-sibling) of the first node in the _previous replacement nodes_.
        3. Otherwise (if the above two conditions fail), abort these steps and return. The _node value setter_ is in a _detached state_.
    2. If the previous sibling associated with *nodeValueSetter* is a [preceding](https://dom.spec.whatwg.org/#concept-tree-preceding) node of the next sibling associated with *nodeValueSetter* in the parent node of *nodeValueSetter*, abort these steps and return. The _node value setter_ is in a _detached state_.
    3. Let *nodesToRemove* be an empty node list.
    4. Let *child* be the [next sibling](https://dom.spec.whatwg.org/#concept-tree-next-sibling) of the previous sibling of *nodeValueSetter.*
    5. While *child* is not the next sibling of *nodeValueSetter* (this could be null):
        1. Add *child* to *nodesToRemove*.
    6. Remove every node in *nodesToRemove* from the parent node of *nodeValueSetter*.
    7. Let *referenceNode* be the next sibling of *nodeValueSetter*.
7. Let the _previous replacement nodes_ of *nodeSetter* be *nodes*.
8. For every *node* in *nodes*:
    1. [Pre-insert](https://dom.spec.whatwg.org/#concept-node-pre-insert) *node* before *referenceNode*.
    2. Let *referenceNode* be *node*.

> Note: This algorithm was devised to respond well to direct mutations made on a template instance as much as possible without having to add additional steps to [remove](https://dom.spec.whatwg.org/#concept-node-remove) a node like [ranges](https://dom.spec.whatwg.org/#concept-range). It allows insertion anywhere inside the parent node as well as removal of any node inserted by the _node value setter_ if the _node value sette_r is _fully templatized_. When the _node value setter_ is _partially templatized_, we only support inserting or removing nodes on one side as well as insertion or removal of nodes inserted by the _node value setter_ as long as it's the node next to the mutated side. If both the node before and the node after the insertion point were removed from the parent node, or if nodes were inserted before or after the insertion point and the node in the _previous replacement node_ on the same side is no longer in the parent, a _partially templatized_ _node value setter_ fails to apply its changes into the template instance. The _node value setter_ can recover from this state if these nodes are re-inserted back into the parent node.

> Note: There is an alternative approach to use this algorithm once inside `createElement`, and have each node template part update itself independently. The benefit of that approach is that updating one node template part wouldn't re-insert nodes from other node template part. The drawback is that it would make the replacements less robust.
