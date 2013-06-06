/*

Simple Bug File Assistant.
Find bugs? File a bug.
To configure, use data-* attributes on <html> as follows:

* Are taken into account all attributes starting with data-bug-*, what follows that is the name
  of the Bugzilla form parameter.
* The name "data-bug-blocked" is special. If present, the assistant adds a link to the dependency
  tree of this bug.
* The name "data-bug-comment" is overriden if the user selects text.

Sample use and configuration:

<html data-bug-blocked='14949' data-bug-short_desc='[Explainer]: ' data-bug-product='WebAppsWG'
      data-bug-component='Component Model'>
  <script src="bug-assist.js"></script>
  ...
*/

document.addEventListener('DOMContentLoaded', function() {
    var BUGS_PREFIX = "data-bug-";

    var inputs = {  comment: "" };

    [].forEach.call(document.documentElement.attributes, function (attr) {
        if (attr.name.indexOf(BUGS_PREFIX) === 0)
            inputs[attr.name.substr(BUGS_PREFIX.length)] = attr.value;
    });

    var blocked = inputs.blocked;

    var form = document.body.appendChild(document.createElement('form'));
    form.style.cssText = 'position:fixed;padding:5px;top:1em;right:2em;font-family:sans-serif;font-size:0.8em;background-color:#ffffff;border: 1px solid #f00;';
    form.action = 'http://www.w3.org/Bugs/Public/enter_bug.cgi';
    form.target = '_blank';
    form.textContent = 'Select text and ';

    var submit = form.appendChild(document.createElement('input'));
    submit.type = 'submit';
    submit.accessKey = 'f';
    submit.style.cssText = 'display: block;';
    var label = 'file a bug';
    if (submit.accessKeyLabel)
        label += ' (' + submit.accessKeyLabel + ')';
    submit.value = label;

    Object.keys(inputs).forEach(function(name) {
        var input = form.appendChild(document.createElement('input'));
        input.type = 'hidden';
        input.name = name;
        input.value = inputs[name];
        inputs[name] = input;
    });

    if (blocked) {
        form.appendChild(document.createTextNode(' or '));
        var a = form.appendChild(document.createElement('a'));
        a.textContent = 'view bugs filed';
        a.href = 'http://www.w3.org/Bugs/Public/showdependencytree.cgi?id=' + blocked;
        a.target = '_blank';
    }
    //form.appendChild(document.createTextNode('.'));

    form.addEventListener('submit', function() {
        var selectedText = window.getSelection().toString();
        if (selectedText)
            inputs.comment.value = '"' + selectedText + '"';
    }, false);

}, false);
