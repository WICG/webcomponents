var autolinkConfig = {

    'http://dom.spec.whatwg.org/': {
        'AT_TARGET': '#dom-event-at_target',
        'DATA_CLONE_ERR': '#dom-domexception-data_clone_err',
        'DOCUMENT_FRAGMENT_NODE': '#dom-node-document_fragment_node',
        'EventInit': '#dictdef-eventinit',
        'InvalidNodeTypeError': '#invalidnodetypeerror',
        'NodeList': '#nodelist',
        'ancestor': '#concept-tree-ancestor',
        'bubbles': '#dom-event-bubbles',
        'child': '#concept-tree-child',
        'cloneNode()': '#dom-node-clonenode',
        'context object': '#context-object',
        'currentTarget': '#dom-event-currenttarget',
        'descendant': '#concept-tree-descendant',
        'document': '#concept-document',
        'document element': '#document-element',
        'element': '#concept-element',
        'event dispatch': '#concept-event-dispatch',
        'event listener invoke': '#concept-event-listener-invoke',
        'event listener': '#concept-event-listener',
        'event': '#events',
        'eventPhase': '#dom-event-eventphase',
        'getElementById': '#dom-nonelementparentnode-getelementbyid',
        'inclusive ancestor': '#concept-tree-inclusive-ancestor',
        'interface Document': '#interface-document',
        'interface DocumentFragment': '#interface-documentfragment',
        'node tree': '#concept-node-tree',
        'node': '#concept-node',
        'nodeName': '#dom-node-nodename',
        'nodeType': '#dom-node-nodetype',
        'ownerDocument': '#dom-node-ownerdocument',
        'parent': '#concept-tree-parent',
        'participate': '#concept-tree-participate',
        'participates': '#concept-tree-participate',
        'preceding': '#concept-tree-preceding',
        'range': '#range',
        'replace all': '#concept-node-replace-all',
        'root': '#concept-tree-root',
        'static': '#concept-collection-static',
        'stop propagation flag': '#stop-propagation-flag',
        'target': '#dom-event-target',
        'tree order': '#concept-tree-order',
        'tree': '#trees'
    },

    'http://html.spec.whatwg.org/': {
        'DOM tree accessors': '#dom-tree-accessors',
        'Document object': '#document',
        'Global attributes': '#global-attributes',
        'HTML': '',
        'HTML elements': '#semantics',
        'HTML fragment serialization algorithm': '#html-fragment-serialization-algorithm',
        'HTMLUnknownElement': '#htmlunknownelement',
        'activeElement': '#dom-document-activeelement',
        'audio element': '#the-audio-element',
        'base element': '#the-base-element',
        'being rendered': '#being-rendered',
        'binding': '#bindings',
        'boolean': '#boolean-attribute',
        'canvas element': '#the-canvas-element',
        'comma separated tokens': '#comma-separated-tokens',
        'contenteditable': '#attr-contenteditable',
        'details element': '#the-details-element',
        'embed element': '#the-embed-element',
        'fallback content': '#fallback-content',
        'fieldset element': '#the-fieldset-element',
        'flow content': '#flow-content',
        'focusable': '#focusable-area',
        'form element': '#the-form-element',
        'form submission': '#form-submission',
        'form-associated element': '#form-associated-element',
        'forms': '#forms',
        'iframe element': '#the-iframe-element',
        'in a document': '#in-a-document',
        'inert': '#inert',
        'img element': '#the-img-element',
        'input element': '#the-input-element',
        'link element': '#the-link-element',
        'map element': '#the-map-element',
        'meter element': '#the-meter-element',
        'named access on the window object': '#named-access-on-the-window-object',
        'object element': '#the-object-element',
        'progress element': '#the-progress-element',
        'reflect': '#reflect',
        'style': '#the-style-attribute',
        'textarea element': '#the-textarea-element',
        'transparent': '#transparent',
        'tree accessors': '#dom-tree-accessors',
        'video element': '#the-video-element',
        'window': '#window'
    },

    'http://dev.w3.org/csswg/selectors4/': {
        'attribute selector': '#attribute-selector',
        'class selector': '#class-selector',
        'compound selector': '#compound',
        'descendant combinators': '#descendant-combinators',
        'id selector': '#id-selector',
        'negation pseudo-class': '#negation',
        'reference element set': '#reference-element-set',
        'relative selector': '#relative-selectors',
        'scope contained selectors': '#scope-contained-selectors',
        'scoped selectors': '#scope',
        'selectors': '',
        'simple selector': '#simple',
        'type selector': '#type-selector',
        'universal selector': '#universal-selector'
    },

    'http://www.w3.org/TR/DOM-Level-3-Events/': {
        'MouseEvent': '#interface-MouseEvent',
        'mutation event': '#interface-MutationEvent',
        'relatedTarget': '#widl-MouseEvent-relatedTarget',
        'topmost event target': '#glossary-topmost-event-target',
        'trusted events': '#trusted-events'
    },

    'http://www.w3.org/TR/touch-events/': {
        'Touch target': '#widl-Touch-target',
        'Touch': '#touch-interface',
        'TouchEvent': '#touchevent-interface',
        'TouchList': '#touchlist-interface',
        'changedTouches': '#widl-TouchEvent-changedTouches',
        'targetTouches': '#widl-TouchEvent-targetTouches',
        'touches': '#widl-TouchEvent-touches'
    },

    'http://www.w3.org/TR/CSS21/': {
        'CSS rules': 'syndata.html#rule-sets',
        'box': 'box.html',
        'formatting structure': 'intro.html#formatting-structure',
        'text-decoration': 'text.html#lining-striking-props'
    },

    'http://www.w3.org/TR/css3-ui/': {
        'directional focus navigation': '#nav-dir',
        'nav-index auto': '#nav-index',
        'navigation order': '#keyboard',
        'sequential focus navigation': '#keyboard'
    },

    'http://www.w3.org/TR/css3-cascade/': {
        'author stylesr': '',
        'cascade order': '#cascade',
        'inheritance': '#inheritance',
        'initial values': '#inital-values'
    },

    'http://www.w3.org/TR/css-variables/': {
        'CSS variables': '',
        'var()': '#using-variables'
    },

    'http://www.w3.org/TR/cssom/': {
        'style sheet': '#style-sheet',
        'StyleSheetList': '#the-stylesheetlist-interface'
    },

    'http://www.w3.org/TR/cssom-view/': {
        'offsetx': '#dom-mouseevent-offsetx',
        'offsety': '#dom-mouseevent-offsety',
        'caretPositionFromPoint': '#dom-document-caretpositionfrompoint',
        'padding edge': '#padding-edge',
        'viewport': '#viewport'
    },

    'https://dvcs.w3.org/hg/editing/raw-file/tip/editing.html': {
        'selection': '#concept-selection',
        'window.getSelection()': '#dom-window-getselection'
    },

    'http://domparsing.spec.whatwg.org/': {
        'parse fragment': '#concept-parse-fragment'
    }

};
