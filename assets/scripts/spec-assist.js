(function() {

function TableOfContentsHelper() {}

TableOfContentsHelper.prototype.help = function()
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

function LastUpdatedHelper()
{
    this.title = document.querySelector('h2#editors-draft');
}

LastUpdatedHelper.prototype.help = function()
{
    if (!this.title)
        return;

    this.fetchLastUpdated(this.appendDate.bind(this));
}

LastUpdatedHelper.prototype.appendDate = function(date)
{
    var prettyDate = this.prettyDate(date);
    this.title.appendChild(document.createTextNode(prettyDate));
}

LastUpdatedHelper.prototype.fetchLastUpdated = function(callback)
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

LastUpdatedHelper.prototype.prettyDate = function(date)
{
    return ' ' + date.getDate() + ' ' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()] + ' ' + date.getFullYear();
}

function DefinitionsHelper() {}

DefinitionsHelper.prototype.help = function()
{
    [].forEach.call(document.querySelectorAll('dfn[id]'), function(definition) {
        definition.setAttribute('title', '#' + definition.id);
    });
}

var helpers = [ LastUpdatedHelper, TableOfContentsHelper, DefinitionsHelper ];

document.addEventListener('DOMContentLoaded', function() {
    helpers.forEach(function(helperConstructor) {
        (new helperConstructor()).help();
    });
});

}());