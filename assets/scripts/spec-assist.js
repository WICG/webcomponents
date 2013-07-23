(function() {

function TableOfContentsEnumerator()
{
}

TableOfContentsEnumerator.prototype.initialize = function()
{
    var top = document.querySelector('section.toc');
    if (!top)
        return;

    this.prefix = [];
    this.enumerateList(top);
}

TableOfContentsEnumerator.prototype.enumerateList = function(top)
{
    var list = top.querySelector('ol,ul');
    if (!list)
        return;

    this.prefix.push(1);
    [].forEach.call(list.children, this.processListItem, this);
    this.prefix.pop();
}

TableOfContentsEnumerator.prototype.processListItem = function(item)
{
    if (!(item instanceof HTMLLIElement))
        return;
    
    var indexText = this.prefix.join('.') + " ";
    var a = item.querySelector('a');
    var href = a.getAttribute('href');
    var target = href && document.querySelector(href);
    if (!target || a.classList.contains('no-number'))
        return;

    a.insertBefore(document.createTextNode(indexText), a.firstChild);
    target.insertBefore(document.createTextNode(indexText), target.firstChild);

    this.enumerateList(item);

    this.prefix[this.prefix.length - 1]++;
}

function LastUpdatedDateFetcher() {}

LastUpdatedDateFetcher.prototype.initialize = function()
{
    this.title = document.querySelector('h2#editors-draft');
    if (!this.title)
        return;

    this.fetchLastUpdated(this.appendDate.bind(this));
}

LastUpdatedDateFetcher.prototype.appendDate = function(date)
{
    var prettyDate = this.prettyDate(date);
    this.title.appendChild(document.createTextNode(prettyDate));
}

LastUpdatedDateFetcher.prototype.fetchLastUpdated = function(callback)
{
    var lastUpdated = new Date();
    var logAnchorNode = document.querySelector('a#log');
    if (!logAnchorNode)
        return callback(lastUpdated);

    var logURL = logAnchorNode.href.replace("/log", "/atom-log");
    if (!logURL)
        return callback(lastUpdated);

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        var doc = this.responseXML;
        if (!doc)
            return callback(lastUpdated);
        var updatedNode = doc.querySelector('feed>updated');
        if (!updatedNode)
            return callback(lastUpdated);
        callback(new Date(updatedNode.textContent));
    }
    xhr.onerror = function() {
        callback(lastUpdated);
    }
    xhr.open('GET', logURL);
    xhr.send();
}

LastUpdatedDateFetcher.prototype.prettyDate = function(date)
{
    return ' ' + date.getDate() + ' ' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()] + ' ' + date.getFullYear();
}

function DefinitionsCrossLinker() {}

DefinitionsCrossLinker.prototype.initialize = function()
{
    [].forEach.call(document.querySelectorAll('dfn[id]'), function(definition) {
        definition.setAttribute('title', '#' + definition.id);
    });
}

var assistants = [ new LastUpdatedDateFetcher(), new TableOfContentsEnumerator(), new DefinitionsCrossLinker() ];

document.addEventListener('DOMContentLoaded', function() {
    assistants.forEach(function(assistant) {
        assistant.initialize();
    });
});

}());