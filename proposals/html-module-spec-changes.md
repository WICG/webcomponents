This is a list of spec areas that will need to be changed to implement our [HTML Modules proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-modules-proposal.md)
Questions/corrections/feedback are welcome!  I've left TODOs in several places where we still have open questions; any input regarding these is especially appreciated.

-- [@dandclark](https://github.com/dandclark), with:\
&nbsp;&nbsp;&nbsp;&nbsp;[@bocupp](https://github.com/BoCupp) [@samsebree](https://github.com/samsebree) [@travisleithead](https://github.com/travisleithead)

# ES6 Spec Changes ([full spec link](https://tc39.github.io/ecma262/)):

These spec changes are built on top of the proposed refactoring here: https://github.com/tc39/ecma262/pull/1311

- Introduce a new subtype of Cyclic Module Record (TODO Add link to Cyclic MR once it's part of the official spec) in addition to the existing [Source Text Module Record](https://tc39.github.io/ecma262/#sourctextmodule-record), named HTML Module Record.
  1. HTML Module Records reuse the [[RequestedModules]] field of Cyclic Module Record, but instead of a list of strings it is a list of ScriptEntry records.  See definition of ParseHTMLModule in HTML5 spec changes for a specification of how these are populated (although it is important to note that ES has no knowledge of this process which involves the HTML Parser, inline vs external script elements etc). 
  _[TODO: This reuse-name-with-different-type is pretty fishy.  Should [[RequestedModules]] in Cyclic MR be generalized as a list that can hold objects of a type specified in each subclass?  Or should we use an entirely new field in HTML MR?  Or should we generate unique IDs for the inline script elements and place them in the Module Map, so that an HTML Module Record can just use strings in [[RequestedModules]]?]._  
  ScriptEntry is defined as:
    
    | Field Name | Value Type | Meaning |
    | --- | --- | --- |
    | [[InlineModuleRecord]] | Module Record \| null | The Module Record for the module request if available at ScriptEntry creation time.  Null otherwise.  |
    | [[ExternalScriptURL]] | String \| null | The URL for the module request if the Module Record was not available at ScriptEntry creation time.  Null otherwise. |
    2. The [[HostDefined]] field in Abstract Module Record will be set to the HTML Module Script (see HTML5 Spec changes).  This is analogous to script modules where this field holds the JavaScript [module script](https://html.spec.whatwg.org/multipage/webappapis.html#module-script) as defined in the HTML5 spec.
- HTML Module Record inherits the concrete Instantiate() method from Cyclic Module Record.
- HTML Module Record defines its own version of [InnerModuleInstantiation](https://tc39.github.io/ecma262/#sec-innermoduleinstantiation).  Cyclic Module Record's definition recursively calls InnerModuleInstantiation on each child module (calling [HostResolveImportedModule](https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule) to resolve module names to Module Records), then calls [ModuleDeclarationEnvironmentSetup](https://tc39.github.io/ecma262/#sec-moduledeclarationenvironmentsetup) to set up the lexical environment and resolve imports/exports for the current module.  HTML Module Record's version will be similar, but will change the definition of step 9 (“For each string required that is an element of module.[[RequestedModules]]...) in order to follow the structure of the newly defined ScriptEntry record as defined above.
  - 9\. For each ScriptEntry *se* in *module*.[[RequestedModules]])
    - a\.	Let *requiredModule* be null.
    - b\. If *se*.[[InlineModuleRecord]]) != null
      - i\. Let *requiredModule* be (*se*.[[InlineModuleRecord]]).
    - c\. Else
      - i\. Let *requiredModule* be HostResolveImportedModule(*module*, *se*.[[ExternalScriptURL]])
    - d\.	Set *index* to ? InnerModuleInstantiation(*requiredModule*, *stack*, *index*).
    - e\.	Assert: *requiredModule*.[[Status]] is either "instantiating", "instantiated", or "evaluated".
    - f\.	Assert: *requiredModule*.[[Status]] is "instantiating" if and only if *requiredModule* is in *stack*.
    - g\.	If *requiredModule*.[[Status]] is "instantiating", then
      - i\. Set *module*.[[DFSAncestorIndex]] to min(*module*.[[DFSAncestorIndex]], *requiredModule*.[[DFSAncestorIndex]]).
- HTML Module Record provides a concrete implementation of InitializeEnvironment(), implementing the corresponding abstract method on Cyclic Module Record.  This function is responsible for creating a mutable binding with the name "\*default\*" that will be used to set up the HTML Module's document as the module's default export.
  1. Let _module_ be this HTML Module Record.
  1. Let _realm_ be _module_.[[Realm]]. 
  1. Assert: _realm_ is not *undefined*.
  1. Let _env_ be NewModuleEnvironment(_realm_.[[GlobalEnv]]).
  1. Set _module_.[[Environment]] to _env_.
  1. Let _envRec_ be _env_'s EnvironmentRecord.
  1. Perform ! _envRec_.CreateMutableBinding("\*default\*", *false*).
  1. Call _envRec_.InitializeBinding("\*default\*", *undefined*).
  1. Return NormalCompletion(empty).
- Declare an implementation-defined abstract operation HostGetDefaultExport(_module_) whose purpose is to return the value of *module*'s default export, or null if there isn't one.
  - Note: See HTML5 spec changes below for the implementation.
- HTML Module Record provides a concrete implementation of ExecuteModule(), implementing the corresponding abstract method on Cyclic Module Record.  For HTML modules there is no script to execute.  This method just sets up the HTML Module's default export, obtained from the implementation-defined HostGetDefaultExport.
  1. _module_ be this HTML Module Record.
  1. Let _defaultExport_ be HostGetDefaultExport(_module_).
  1. Let _envRec_ be _module_.[[Environment]]'s EnvironmentRecord.
  1. Call _envRec_.SetMutableBinding("\*default\*", _defaultExport_, *false*).
  1. Return NormalCompletion(empty).
- HTML Module Record should implement a modified version of [GetExportedNames](https://tc39.github.io/ecma262/#sec-getexportednames)(*exportStarSet*), as follows:
  - 1\. Let *module* be this HTML Module Record.
  - 2\. If *exportStarSet* contains *module*, then
    - a\.	Assert: We've reached the starting point of an import * circularity.
    - b\.	Return a new empty List.
  - 3\.	Append *module* to *exportStarSet*.
  - 4\.	Let *exportedNames* be a new empty List.
  - 5\.	For each ScriptEntry *se* in *module*.[[RequestedModules]]), do:
    - a\. If *se*.[[InlineModuleRecord]] != nullInlineModuleRecord:
      - i\. Let *starNames* be *se*.[[InlineModuleRecord]].GetExportedNames(*exportStarSet*).
      - ii\. For each element *n* of *starNames*, do
        - a\. If SameValue(*n*, "default") is false, then
          - i\. If *n* is not an element of *exportedNames*, then
            - a\.  Append *n* to *exportedNames*.
  - 6\. Return *exportedNames*.
- HTML Module Record should implement a modified version of [ResolveExport](https://tc39.github.io/ecma262/#sec-resolveexport)(*exportName*, *resolveSet*). This function’s purpose is to “resolve an imported binding to the actual defining module and local binding name”.  For HTML Modules, instead of looking for local exports etc. we’ll iterate through each inline script and export their contents as for an ‘export *’.  We redefine as follows:
  - 1\.	Let *module* be this HTML Module Record.
  - 2\.	For each Record { [[Module]], [[ExportName]] } *r* in resolveSet, do
    - a\.	If *module* and *r*.[[Module]] are the same Module Record and SameValue(*exportName*, *r*.[[ExportName]]) is true, then
      - i\. Assert: This is a circular import request.
      - ii\. Return null.
  - 3\. Append the Record { [[Module]]: *module*, [[ExportName]]: *exportName* } to resolveSet.
  - 4\.	Let *resolution* be null.
  - 5\.	For each ScriptEntry record *se* in *module*.[[RequestedModules]], do:
    - a\.	If *se*.[[ExternalScriptURL]] != null, continue to next record.
    - b\.	Let *importedModule* be *se*.[[InlineModuleRecord]]).
    - c\.	Let *singleResolution* be ? *importedModule*.ResolveExport(*exportName*, *resolveSet*).
    - d\.	If *singleResolution* is "**ambiguous**", return "**ambiguous**".
    - e\.	If *singleResolution* is not null, then
      - i\.	Assert: *singleResolution* is a ResolvedBinding Record.
      - ii\. If *resolution* is null, set *resolution* to *singleResolution*.
      - iii\. Else,
        - a\. Assert: There is more than one inline script that exports the requested name.
        - b\.	Return "**ambiguous**".
  - 6\. If *resolution* is null and SameValue(*exportName*, "default") is true, then
    - a\.	Let *resolution* be a ResolvedBinding Record { [[Module]]: *module*, [[BindingName]]: *\*default\** }
    - b\. NOTE 1: *\*default\** was set up to reference the HTML Module's document during instantiation/execution
    - c\.	NOTE 2: I assume here that we’re not trying to pass through default exports of the inline scripts.
  - 7\. Return *resolution*.
- HTML Module Record inherits the concrete Evaluate() method from Cyclic Module Record.
- HTML Module Record should implement a modified version of Cyclic Module Record's [InnerModuleEvaluation](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script)(*module*, *stack*, *index*).  This method calls InnerModuleEvaluation on each child module, then executes the current module.  The HTML Module version will have the following changes (TODO Make sure these step numbers are still correct after Cyclic Module Record is merged into the official spec):
  - Change step 10 and step 10a to be the following, to account for the different structure of HTML Module Record vs Cyclic Module Record.  Steps 10b-10f remain the same:
    - 10\. For each ScriptEntry *se* in *module*.[[RequestedModules]]), do:
      - a\. If (*se*.[[InlineModuleRecord]] != null), let *requiredModule* be *se*.[[InlineModuleRecord]], else let *requiredModule* be HostResolveImportedModule(*module*, *se*.[[ExternalScriptURL]])
- Note that we don't define any operation in ES for creation of HTML Module Records.  This is implemented entirely in HTML5 (see spec changes below). 

# HTML5 spec changes ([full spec link](https://html.spec.whatwg.org/)):
- Introduce a third type of [script](https://html.spec.whatwg.org/multipage/webappapis.html#concept-script) named HTML Module Script.  It has the following item in addition to script:
  - A `document`: The [Document](https://html.spec.whatwg.org/multipage/dom.html#document) for the HTML Module, or null. 
- Rename the existing concept of [module script](https://html.spec.whatwg.org/multipage/webappapis.html#module-script) to JavaScript module script.
- Redefine "module script" as a union of JavaScript module script or HTML module script.
  - Broadly speaking, the usage of "module script" in most of the module fetching algos ([[1](https://html.spec.whatwg.org/#fetch-a-module-script-graph)], [[2](https://html.spec.whatwg.org/#internal-module-script-graph-fetching-procedure)], [[3](https://html.spec.whatwg.org/#fetch-a-single-module-script)], [[4](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script)], [[5](https://html.spec.whatwg.org/#fetch-the-descendants-of-and-instantiate-a-module-script)], [[6](https://html.spec.whatwg.org/#finding-the-first-parse-error)]) will refer to this new definition of module script, as they will be generalized to both HTML and JavaScript modules.
- In [prepare a script](https://html.spec.whatwg.org/#prepare-a-script), when defining a script’s type in step 7, always set it to “module” if we’re parsing an HTML Module.  TODO How to determine that?  New parser flag?
- Rename [create a module script](https://html.spec.whatwg.org/#fetching-scripts:creating-a-module-script) to "create a JavaScript module script".
- Introduce a new algorithm “create an HTML module script”, similar to [create a module script](https://html.spec.whatwg.org/#fetching-scripts:creating-a-module-script).  The definition would look something like this:
  - To create an HTML module script, given a JavaScript string *source*, an environment settings object *settings*, a URL *baseURL*, and some script fetch options *options*:
  - 1\.	Let *htmlModuleScript* be a new HTML module script that this algorithm will subsequently initialize.
  - 2\.	Set *htmlModuleScript*'s settings object to *settings*.
  - 3\.	Set *htmlModuleScript*'s *base URL* to *baseURL*.
  - 4\.	Set *htmlModuleScript*'s fetch options to *options*.
  - 5\. Set *htmlModuleScript*'s *parse error* and *error to rethrow* to null.
  - 6\. Let *result* be ParseHTMLModule(*source*, *settings's* Realm, *htmlModuleScript*). Note: Passing *htmlModuleScript* as the last parameter here ensures *result*.[[HostDefined]] will be *htmlModuleScript*.  See below bullet for ParseHTMLModule definition.
  - 7\. For each ScriptEntry *required* of *result*.[[RequestedModules]], such that *required*[[InlineModuleRecord]] == null:
    - a\.	Let *url* be the result of resolving a module specifier given *htmlModuleScript*'s *base URL* and *required*[[ExternalScriptURL]].
    - b\.	If *url* is failure, then:
      - i\.	Let *error* be a new TypeError exception.
      - ii\.	Set *htmlModuleScript*'s *parse error* to *error*.
      - iii\.	Return *htmlModuleScript*.  Note: This step is essentially validating all of the requested module specifiers. We treat a module with unresolvable module specifiers the same as one that cannot be parsed; in both cases, a syntactic issue makes it impossible to ever contemplate instantiating the module later.
  - 8\. Set *htmlModuleScript*'s *record* to *result*.
  - 9\. Return *htmlModuleScript*.
- Introduce a new algorithm ParseHTMLModule(*source*, *realm*, *htmlModuleScript*) as the following.
  - 1\.	Run the HTML5 parser on *source* to obtain the result *document*.
    - a\. TODO: This needs to be fleshed out more.  Do we need to run the parser in a special mode to ensure that nothing is fetched and no script runs?  Script execution should already be [disabled because the HTML Module document does not have a browsing context](https://html.spec.whatwg.org/#concept-n-noscript), but the case for fetching is less clear. We also need to specify the special handling for non-module `<script>` elements.
  - 2\. Set *htmlModuleScript*[[document]] to *document*
  - 2\. Let *scriptEntries* be an empty list of ScriptEntry Records (see definition in ES6 changes above).
  - 3\.	For each HTMLScriptElement *script* in *document*:
    - a\.	Let *se* be a new ScriptEntry record.
    - b\.	If *script* is inline:
      - i\.	Set *se*[[InlineModuleRecord]] = *script’s* Source Text Module Record
      - ii\.	Set *se*[[ExternalScriptURL]] = null
    - c\.	Else  
      - i\.	Set *se*[[InlineModuleRecord]] = null
      - ii\. Set *se*[[ExternalScriptURL]] = *script’s* src URL
    - d\.	Append *se* to *scriptEntries*.
  - 4\. Return a new HTML Module Record { [[Realm]]: *realm*, [[Environment]]: *undefined*, [[Namespace]]: *undefined*, [[Status]]: `"uninstantiated"`, [[EvaluationError]]: *undefined*, [[HostDefined]]: *htmlModuleScript*, [[RequestedModules]]: *scriptEntries*, [[DFSIndex]]: *undefined*, [[DFSAncestorIndex]]: *undefined* }.
- Provide an implementation of the abstract operation HostGetDefaultExport(*module*) as the following:
  1. Assert: *module* is an HTML Module.  Note: It is anticipated that in the future this may be expanded to support other module types (JSON etc).
  1. Let *htmlModuleScript* be *module*.[[HostDefined]].
  1. Let *document* be *htmlModuleScript*'s *document*.
  1. Return *document*.
- [Fetch a single module script](https://html.spec.whatwg.org/#fetch-a-single-module-script) will be changed to support an HTML Module MIME type in addition to JavaScript types.  This will either be `text/html` or a new type introduced for HTML Modules; see discussion [here](https://github.com/w3c/webcomponents/issues/742).  Specifically:
  - In step 9, allow the HTML Module MIME type type through in addition to JavaScript.
  - In step 11, don’t unconditionally [create a module script](https://html.spec.whatwg.org/#fetching-scripts:creating-a-module-script).  Instead, key off the MIME type extracted in step 9, using the “create an HTML module script” steps instead if we have an HTML Modules MIME type.
- Replace step 5 of [fetch the descendants of a module script](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script) with the following steps:
  - 5\. If *module script* is a JavaScript module script, then:
    - 1\. [For each](https://infra.spec.whatwg.org/#list-iterate) string *requested* of *record*.[[RequestedModules]],
      - 1\. Let *url* be the result of [resolving a module specifier](https://html.spec.whatwg.org/#resolve-a-module-specifier) given *module script*'s [base URL](https://html.spec.whatwg.org/#concept-script-base-url) and *requested*.
      - 2\. Assert: *url* is never failure, because [resolving a module specifier](https://html.spec.whatwg.org/#resolve-a-module-specifier) must have been [previously successful](https://html.spec.whatwg.org/#validate-requested-module-specifiers) with these same two arguments.
      - 3\. If *visited set* does not [contain](https://infra.spec.whatwg.org/#list-contain) *url*, then:
        - 1\. [Append](https://infra.spec.whatwg.org/#list-append) *url* to *urls*.
        - 2\. [Append](https://infra.spec.whatwg.org/#list-append) *url* to *visited set*.
  - 6\. Otherwise, *module script* is an HTML module script.  Perform the following steps:
    - 1\. [For each](https://infra.spec.whatwg.org/#list-iterate) ScriptEntry *entry* of *record*.[[RequestedModules]],
      - 1\. If *entry*.[[ExternalScriptURL]] != null, then:
        - 1\. Let *url* be the result of [resolving a module specifier](https://html.spec.whatwg.org/#resolve-a-module-specifier) given *module script*'s [base URL](https://html.spec.whatwg.org/#concept-script-base-url) and *entry*.[[ExternalScriptURL]].
        - 2\. Assert: *url* is never failure, because [resolving a module specifier](https://html.spec.whatwg.org/#resolve-a-module-specifier) must have been [previously successful](https://html.spec.whatwg.org/#validate-requested-module-specifiers) with these same two arguments.
        - 3\. If *visited set* does not [contain](https://infra.spec.whatwg.org/#list-contain) *url*, then:
          - 1\. [Append](https://infra.spec.whatwg.org/#list-append) *url* to *urls*.
          - 2\. [Append](https://infra.spec.whatwg.org/#list-append) *url* to *visited set*.
