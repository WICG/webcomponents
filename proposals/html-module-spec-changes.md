This is a list of spec areas that will need to be changed to implement our [HTML Modules proposal](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-modules-proposal.md).  Some of the proposed changes are very specific and some are more handwavy depending on how deep I've investigated into that particular area.
Questions/corrections/feedback are welcome!  I've left TODOs in several places where we still have open questions; any input regarding these is especially appreciated.

-- [@dandclark](https://github.com/dandclark), with:\
&nbsp;&nbsp;&nbsp;&nbsp;[@bocupp](https://github.com/BoCupp) [@samsebree](https://github.com/samsebree) [@travisleithead](https://github.com/travisleithead)

# ES6 Spec Changes ([full spec link](https://tc39.github.io/ecma262/)):
- Introduce a new subtype of [Abstract Module Record](https://tc39.github.io/ecma262/#sec-abstract-module-records) in addition to the existing [Source Text Module Record](https://tc39.github.io/ecma262/#sourctextmodule-record).  Proposed name for the new subtype is HTML Module Record.
  1.	HTML Module record has these fields in common with Source Text Module Record (perhaps they should move up to Abstract Module Record): [[Status]], [[EvaluationError]], [[DFSIndex]], [[DFSAncestorIndex]].
  2.	In addition HTML Module Records have this new field: 
    [[RequestedModules]]: A list of ScriptEntry records, appearing in document order per the position of the corresponding script elements in the HTML Document. ScriptEntry is defined as:
    
    | Field Name | Value Type | Meaning |
    | --- | --- | --- |
    | [[IsInline]] |bool | Is this entry from an inline script? |
    | [[ModuleRecord]] | Source Text Module Record \| null | The source text module record for the script element if IsInline == true |
    | [[SourceName]] | String \| null | The name specified in the script’s src attribute if IsInline == false.  Null otherwise. |
    3. Additionally, the [[HostDefined]] field in Abstract Module Record should be used to hold the document, or an HTML Module object on the HTML5 spec side that will hold the document.  It’s basically meant as an abstract container for the HTML5 spec side of things to stash data that it defines -- for script modules this holds the [module script](https://html.spec.whatwg.org/multipage/webappapis.html#module-script) as defined in the HTML5 spec.
- HTML Module record should have a modified version of [InnerModuleInstantiation](https://tc39.github.io/ecma262/#sec-innermoduleinstantiation).  In short, the existing definition of this function recursively calls InnerModuleInstantiation on each child module (calling [HostResolveImportedModule](https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule) to resolve module names to Source Text Module Records), then calls [ModuleDeclarationEnvironmentSetup](https://tc39.github.io/ecma262/#sec-moduledeclarationenvironmentsetup) to set up the lexical environment and resolve imports/exports for the current module.  In order to follow the structure of the newly defined ScriptEntry record as defined above, we will change the current definition of InnerModuleInstantiation’s step 9 (“For each string required that is an element of module.[[RequestedModules]]...)
  - 9\. For each ScriptEntry *se* in *module*.[[RequestedModules]])
    - a\.	Let *requiredModule* be null.
    - b\. If *se*.[[IsInline]]) == true
      - i\. Let *requiredModule* be (*se*.[[ModuleRecord]]).
    - c\. Else
      - i\. Let *requiredModule* be HostResolveImportedModule(*module*, *se*.[[SourceName]])
    - d\.	Set *index* to ? InnerModuleInstantiation(*requiredModule*, *stack*, *index*).
    - e\.	Assert: *requiredModule*.[[Status]] is either "instantiating", "instantiated", or "evaluated".
    - f\.	Assert: *requiredModule*.[[Status]] is "instantiating" if and only if *requiredModule* is in *stack*.
    - g\.	If *requiredModule*.[[Status]] is "instantiating", then
      - i\.	Assert: *requiredModule* is a Source Text Module Record.
      - ii\. Set *module*.[[DFSAncestorIndex]] to min(*module*.[[DFSAncestorIndex]], *requiredModule*.[[DFSAncestorIndex]]).
- HTML Module record should implement a modified version of [ModuleDeclarationEnvironmentSetup](https://tc39.github.io/ecma262/#sec-moduledeclarationenvironmentsetup).  Called from InnerModuleInstantiation, this function sets up the lexical environment and resolves imports/exports for the current module.  For HTML Modules, there is no distinct lexical environment so we may just redefine this to be a no-op, or further modify the HTML Module version of InnerModuleInstantiation to skip it altogether.  Note that the ‘export * from all inline script elements’ stuff is performed in our redefined [ResolveExport](https://tc39.github.io/ecma262/#sec-resolveexport) below.
- HTML Module Record should implement a modified version of [GetExportedNames](https://tc39.github.io/ecma262/#sec-getexportednames)(*exportStarSet*), as follows:
  - 1\. Let *module* be this Source Text Module Record.
  - 2\. If *exportStarSet* contains *module*, then
    - a\.	Assert: We've reached the starting point of an import * circularity.
    - b\.	Return a new empty List.
  - 3\.	Append *module* to *exportStarSet*.
  - 4\.	Let *exportedNames* be a new empty List.
  - 5\.	For each ScriptEntry *se* in *module*.[[RequestedModules]]), do:
    - a\. If *se*.[[IsInline]] == true:
      - i\. Let *starNames* be *se*.[[ModuleRecord]].GetExportedNames(*exportStarSet*).
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
  - 4\.	If SameValue(*exportName*, "default") is true, then
    - a\.	Return the HTML Document associated with this HTML Module record.  TODO How do we actually return this as a resolved binding if the HTML record has no lexical scope?  Maybe the record needs to have one?
    - b\.	NOTE: I assume here that we’re not trying to pass through default exports of the inline scripts.
  - 5\.	Let *starResolution* be null.
  - 6\.	For each ScriptEntry record *se* in *module*.[[RequestedModules]], do:
    - a\.	If *se*.[[IsInline]] == false, continue to next record.
    - b\.	Let *importedModule* be *se*.[[ModuleRecord]]).
    - c\.	Let *resolution* be ? importedModule.ResolveExport(*exportName*, *resolveSet*).
    - d\.	If *resolution* is "**ambiguous**", return "**ambiguous**".
    - e\.	If *resolution* is not null, then
      - i\.	Assert: *resolution* is a ResolvedBinding Record.
      - ii\. If *starResolution* is null, set *starResolution* to *resolution*.
      - iii\. Else,
        - a\. Assert: There is more than one inline script that exports the requested name.
        - b\.	Return "**ambiguous**".
  - 7\. Return *starResolution*.
- We need to redefine how the HTML Module is created and its fields are populated.  Instead of populating the fields in [ParseModule](https://tc39.github.io/ecma262/#sec-parsemodule), we will create the module based on input from the result of parsing the HTML Document on the HTML5 side.  See HTML5 spec proposed changes below.
- HTML Module Record should implement a modified version of [InnerModuleEvaluation](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script)(*module*, *stack*, *index*).  This method calls InnerModuleEvaluation on each child module, then executes the current module.  The HTML Module version will have the following changes:
  - Change step 10 and step 10a to be the following, to account for the different structure of HTML Module Record vs Source Text Module Record.  Steps 10b-10f remain the same:
    - 10\. For each ScriptEntry *se* in *module*.[[RequestedModules]]), do:
      - a\. If (*se*.[[IsInline]] == true), let *requiredModule* be *se*.[[ModuleRecord]], else let *requiredModule* be HostResolveImportedModule(*module*, *se*.[[SourceName]])
   - Omit step 11 (since the HTML module doesn’t have any JS code of its own to run; it only recurses to run the code of its requested modules per step 10).
 
# HTML5 spec changes ([full spec link](https://html.spec.whatwg.org/)):
- Broadly speaking, the language throughout most of the module fetching algos ([[1](https://html.spec.whatwg.org/#fetch-a-module-script-graph)], [[2](https://html.spec.whatwg.org/#internal-module-script-graph-fetching-procedure)], [[3](https://html.spec.whatwg.org/#fetch-a-single-module-script)], [[4](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script)], [[5](https://html.spec.whatwg.org/#fetch-the-descendants-of-and-instantiate-a-module-script)], [[6](https://html.spec.whatwg.org/#finding-the-first-parse-error)]) needs to be generalized from “module script” to “module”, e.g. s/fetch a single module script/fetch a single module/.
- In [prepare a script](https://html.spec.whatwg.org/#prepare-a-script), when defining a script’s type in step 7, always set it to “module” if we’re parsing an HTML Module.  TODO How to determine that?  New parser flag?
- Introduce a “create an HTML Module”, similar to [create a module script](https://html.spec.whatwg.org/#fetching-scripts:creating-a-module-script).  The definition would look something like this:
  - To create an HTML module, given a JavaScript string *source*, an environment settings object *settings*, a URL *baseURL*, and some script fetch options *options*:
  - 1\.	Let *htmlModule* be a new HTML Module that this algorithm will subsequently initialize.
  - 2\.	Set *htmlModule’s* settings object to *settings*.
  - 3\.	 Set *htmlModule’s* *base URL* to *baseURL*.
  - 4\.	Set *htmlModule’s* fetch options to *options*.
  - 5\.	 Set *htmlModule's* *parse error* and *error to rethrow* to null.
  - 6\.	 Let *result* be ParseHTMLModule(*source*, *settings's* Realm, *htmlModule*). Note: Passing *htmlModule* as the last parameter here ensures *result*.[[HostDefined]] will be *htmlModule*.  See below bullet for ParseHTMLModule definition.
  - 7\.	 For each ScriptEntry *required* of *result*.[[RequestedModules]], such that *required*[[IsInline]] == false:
    - a\.	Let *url* be the result of resolving a module specifier given *htmlModule’s* *base URL* and *required*[[SourceName]].
    - b\.	If *url* is failure, then:
      - i\.	Let *error* be a new TypeError exception.
      - ii\.	Set *htmlModule’s* *parse error* to *error*.
      - iii\.	Return *htmlModule*.  Note: This step is essentially validating all of the requested module specifiers. We treat a module with unresolvable module specifiers the same as one that cannot be parsed; in both cases, a syntactic issue makes it impossible to ever contemplate instantiating the module later.
  - 8\.   Set *htmlModule’s* *record* to *result*.
  - 9\.   Return *htmlModule*.
- Define ParseHTMLModule(*source*, *realm*, *htmlModule*) as roughly the following.  TODO Given that we define  HTML Module Record in ES6, should this function be defined over there?  We’re using the HTML5 parser though...
  - 1\. Let *record* be a new HTML Module record that this algorithm will subsequently initialize. 
  - 2\.	Run the HTML5 parser on source to obtain the result *document*.
  - 3\.	Set *record*.[[HostDefined]] = *htmlModule*.
  - 4\.	For each HTMLScriptElement *script* in *document*:
    - a\.	Let *se* be a new ScriptEntry record (see definition in ES6 changes above).
    - b\.	If *script* is inline:
      - i\.	Set *se*[[IsInline]] = true
      - ii\.	Set *se*[[RequestedModule]] = *script’s* Source Text Module Record
      - iii\.	Set *se*[[SourceName]] = null
    - c\.	Else  
      - i\.	Set *se*[[IsInline]] = false
      - ii\.	Set *se*[[RequestedModule]] = null
      - iii\.	Set *se*[[SourceName]] = *script’s* src URL
    - d\.	Append *se* to *record*.[[RequestedModules]]
  - 5\.	Return *record*.
- Change fetch a [single module script](https://html.spec.whatwg.org/#fetch-a-single-module-script) as follows:
  - In step 9, allow HTML MIME type through in addition to JavaScript.
  - In step 11, don’t unconditionally [create a module script](https://html.spec.whatwg.org/#fetching-scripts:creating-a-module-script).  Instead, key off the MIME type extracted in step 9, creating an HTML Module instead if we have an HTML MIME type.
- Change step 5 of [fetch the descendants of a module script](https://html.spec.whatwg.org/#fetch-the-descendants-of-a-module-script) such that when record is an HTML Module, use [[SourceName]] from each *record*.[[RequestedModules]] instead of the Source Text Module Record field *record*.[[RequestedModules]].  This change basically just accounts for the differences in how Source Text Module Record and HTML Module Record store their descendant module URLs.
