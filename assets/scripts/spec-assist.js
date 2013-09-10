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
    document.addEventListener('click', this.onClick.bind(this));
    this.hovercard = document.createElement('b');
    this.hovercard.className = 'hovercard';
    [].forEach.call(document.querySelectorAll('dfn[id]'), this.createCrossLinks, this);
}

DefinitionsCrossLinker.prototype.onClick = function(event)
{
    var element = event.target;
    if (element.tagName != 'DFN' || element.contains(this.hovercard)) {
        this.closeHovercard();
        return;
    }

    this.openHovercard(element);
}

DefinitionsCrossLinker.prototype.openHovercard = function(dfn)
{
    this.hovercard.innerHTML = dfn.crossLinkContent;
    dfn.appendChild(this.hovercard);
}

DefinitionsCrossLinker.prototype.closeHovercard = function(dfn)
{
    if (!this.hovercard.parentElement)
        return;

    this.hovercard.parentElement.removeChild(this.hovercard);
}

DefinitionsCrossLinker.prototype.findCrossLinkHeading = function(a)
{
    var element = a;
    while(element = element.previousSibling || element.parentElement) {
        if (element instanceof HTMLHeadingElement && element.id)
            break;
    }
    return element;
}

DefinitionsCrossLinker.prototype.createCrossLink = function(backId, title)
{
    return '<a href="#' + backId + '">' + title + '</a> ';
}

DefinitionsCrossLinker.prototype.createCrossLinks = function(dfn)
{
    var id = dfn.id;
    var links = ['No references.'];

    if (!dfn.classList.contains('no-backreference')) {
        var headings = {};
        [].forEach.call(document.querySelectorAll('a[href="#' + id + '"]'), function(a, i) {
            var backId;
            if (a.id) {
                backId = a.id;
            } else {
                backId = 'back-' + id + '-' + i;
                a.id = backId;
            }
            var heading = this.findCrossLinkHeading(a);
            var titles = headings[heading.id];
            if (titles)
                titles.push(this.createCrossLink(backId, '(' + (titles.length + 1) + ')'));
            else
                titles = headings[heading.id] = [ this.createCrossLink(backId, heading.textContent) ];
        }, this);

        var keys = Object.keys(headings);
        if (!keys.length) {
            dfn.classList.add('no-references');
        } else  {
            links = keys.map(function(key) {
                return '<li>' + headings[key].join('') + '</li>';
            });
        }
    }
    dfn.crossLinkContent = '<div class="title"><a href="#' + id + '">#' + id + '</a></div><ol>' + links.join('') + '</ol>';
}

var assistants = [ new LastUpdatedDateFetcher(), new TableOfContentsEnumerator(), new DefinitionsCrossLinker() ];

document.addEventListener('DOMContentLoaded', function() {
    assistants.forEach(function(assistant) {
        assistant.initialize();
    });
});

}());