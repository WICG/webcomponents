# Declarative Syntax for Custom Elements

Here is one approach for the declarative syntax for custom elements we have been considering.
We have not necessarily come to a conclusion as to whether this is the best approach but we think this is a good starting point to stir the discussion.

## 1. Syntax

First, with the proposed template instantiation API in mind, we imagined a HTML syntax to define a custom element as follows:

```html
<definition name="my-element" constructor="MyElement">
    <template shadowmode="closed">~</template>
    <script>
      class MyElement extends HTMLElement { ~ }
    </script>
</definition>
```

Here, `definition` is a new element which defines a custom element. `name` content attribute specifies its name and `constructor` content attribute specifies the constructor object which is passed to `window.customElements.define` in the imperative API. We look up the constructor first in the script elements within the definition element then fallback to the global scope.

This still requires having to repeat the constructor name twice. We can avoid this if we checked the result of each script element's *program* and checked if any of them evaluates to a class extending HTML element in the case the constructor content attribute is omitted. This is a bit weird and won't technically work since a class statement doesn't yield a value according to ECMA2017 although browser behaviors have been inconsistent in this regard until now (e.g. in the shipping version of Safari, a class statement still evaluates to the declared class, and Chrome used to do the same until earlier this year) so it's probably still possible to change ECMA spec to always yield a value just like function declarations. With that, we can make the constructor content attribute optional:

```html
<definition name="my-element">
    <template shadowmode="closed">~</template>
    <script type="module">
      export default class MyElement extends HTMLElement { ~ }
    </script>
</definition>
```

## 2. Creating a Shadow Tree Without Scripts

In the case we didn't have any script, we can automatically create a new default custom element class, which is equivalent to having the following JavaScript code, and attach a shadow tree with an instance of template using the proposed template instantiation API. 

```js
class /* default custom element */ extends HTMLElement {
    #shadowRoot; // This is the syntax for a private variable in ECMAScript 2018+
    #templateInstance;
    constructor(...args) {
        super(...args);
        const template = customElements.getTemplate(this);
        if (!template)
            return;
        #shadowRoot = this.attachShadow({mode: template.getAttribute('shadowmode')});
        #templateInstance = #shadowRoot.appendChild(template.createInstance(#shadowRoot));
    }
    attributeChangedCallback(attributeName, oldValue, newValue, namespace) {
        #templateInstance.update(#shadowRoot);
    }
}
```

Here, `customElements.getTemplate` is a helper function which finds the template element bound at the time of definition. We store the shadow root and the template instance as private states of the custom element.

Note that the shadow root of the custom element is passed to createInstance's state variable. This allows the template in a custom element to use custom element's instance's attribute values without writing a single line of scripts as follows:

```html
<definition name="percentage-bar">
    <template shadowmode="closed">
        <div id="progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{root.attributes.percentage.value}}">
            <div id="bar" style="width: {{root.attributes.percentage.value}}%"></div>
            <div id="label"><slot></slot></div>
        </div>
        <style>
            :host { display: inline-block !important; }
            #progressbar { position: relative; display: block; width: 100%; height: 100%; }
            #bar { background-color: #36f; height: 100%; }
            #label { position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; text-align: center; }
        </style>
    </template>
</definition>
```

We could use the following instance to make a bar graph showing 20% progress:

```html
<percentage-bar percentage="20">Initializing...</percentage-bar>
```

Because attributeChangedCallback automatically updates the template instance, updating the attribute value to, say, 40, would automatically update the bar graph.


> Note: This example really demonstrates the need to be able to set various ARIA values on the shadow host without wrapping it in a container within a shadow tree.

## 3. Creating a Shadow Tree with Author-Defined Custom Element Classes

In the case the author supplies the custom element class (which is probably the majority of cases), we can't simply create a shadow tree in the HTMLElement constructor since the ECMA2018/2019 still doesn't provide a protected variable, and `super` call must return `this`. It would mean that we'd have to either make the shadow tree exposed to all other external scripts (by making it open), or not letting author scripts access the shadow tree. Since it's possible for custom elements to not needing shadow trees (especially in cases where the author supplies a custom element class), it's better to let each custom element class attach its own shadow root instead on demand.

To make creating a shadow root for a custom element easy, we can provide a helper function which finds the template element associated with the custom element and automatically attach a shadow root as follows: 

```html
<definition name="my-vdom-custom-element">
    <template>~</template>
    <script type="module">
        export default class MyVDOMCustomElement extends HTMLElement {
            #template;
            constructor(state, ...args) {
                super(state, ...args);
                #template = customElements.attachTemplateAsShadow(this, state);
            }
            render(state) {
                #template.update(state);
            }
        }
    </script>
</definition>
```

In this example, `customElements.attachTemplateAsShadow` would automatically find the template element associated with the custom element of `this`, and attach a shadow root of the specified type, instantiate the template with `state`, which is the first argument to the constructor. We can make the second argument optional and automatically fallback to the newly created shadow root. In that case, we could also supply the default `attributeChangedCallback` which automatically invokes the template instance's `update` with the shadow root.

The challenge here is whether a helper function, `customElements.attachTemplateAsShadow`, should return the shadow root, the template instance, or both. If it returns a shadow root, then the author would have no way of accessing the original template instance unless one of the nodes in the template instance or the shadow root itself references back the template instance. Returning the template instance is a bit more appealing since we could totally add a helper which retrieves the parent node under which children of a template had been inserted. e.g. `templateInstance.parentNode`.

