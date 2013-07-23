(function() {

function TableOfContentsEnumerator() {}

TableOfContentsEnumerator.prototype.initialize = function()
{
    [].forEach.call(document.querySelectorAll('section.toc li span.section'), function(sectionNumber) {
        var href = sectionNumber.parentElement.getAttribute('href');
        var target = href && document.querySelector(href);
        if (target) {
            target.insertBefore(document.createTextNode(' '), target.firstChild);
            target.insertBefore(sectionNumber.cloneNode(true), target.firstChild);
        }
    });    
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