/*

Simple Bug File Assistant.
Find bugs? File a bug, blocking https://www.w3.org/Bugs/Public/show_bug.cgi?id=15013.
To configure, use meta tags as follows:

* The content of each meta tag whose name starts with "bug." becomes a form parameter for Bugzilla new bug submission.
* The name "bug.blocked" is special. If present, the assistant add a link to the dependency tree of this bug.
* The name "bug.comment" is overriden if the user selects text.

Sample use and configuration:

<script src="https://dvcs.w3.org/hg/webcomponents/raw-file/tip/assets/scripts/bug-assist.js"></script>
<meta name="bug.blocked" content="14949">
<meta name="bug.short_desc" content="[Explainer]: ">
<meta name="bug.product" content="WebAppsWG">
<meta name="bug.component" content="Component Model">

*/

document.addEventListener('DOMContentLoaded', function() {
    var BUGS_PREFIX = 'bug.';

    var inputs = {  comment: '' };

    [].forEach.call(document.querySelectorAll('meta'), function(meta) {
        if (meta.name.indexOf(BUGS_PREFIX) == 0)
            inputs[meta.name.substr(BUGS_PREFIX.length)] = meta.content;
    });

    var blocked = inputs.blocked;

    var form = document.body.appendChild(document.createElement('form'));
    form.style.cssText = 'position:fixed;width:10em;top:1em;right:1em;font-family:Tahoma,sans-serif;font-size:11px;opacity:0.8;text-align:right';
    form.action = '//www.w3.org/Bugs/Public/enter_bug.cgi';
    form.target = '_blank';
    form.textContent = 'See a problem? Select text and ';

    var submit = form.appendChild(document.createElement('input'));
    submit.type = 'submit';
    submit.accessKey = 'f';
    submit.style.cssText = 'font-family:Tahoma,sans-serif;font-size:10px';
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
        a.href = '//www.w3.org/Bugs/Public/showdependencytree.cgi?id=' + blocked;
        a.target = '_blank';
    }
    form.appendChild(document.createTextNode('.'));

    form.addEventListener('submit', function() {
        var selectedText = window.getSelection().toString();
        if (selectedText)
            inputs.comment.value = '"' + selectedText + '"';
    }, false);

}, false);
