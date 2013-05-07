(function() {

function fetchLastUpdated(callback)
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

function prettyDate(date) {
    return ' ' + date.getDate() + ' ' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()] + ' ' + date.getFullYear();
}

document.addEventListener('DOMContentLoaded', function() {
    var title = document.querySelector('h2#editors-draft');
    if (title) {
        fetchLastUpdated(function(date) {
            title.appendChild(document.createTextNode(prettyDate(date)));
        });
    }
    [].forEach.call(document.querySelectorAll('section.toc li span.section'), function(sectionNumber) {
        var href = sectionNumber.parentElement.getAttribute('href');
        var target = href && document.querySelector(href);
        if (target) {
            target.insertBefore(document.createTextNode(' '), target.firstChild);
            target.insertBefore(sectionNumber.cloneNode(true), target.firstChild);
        }
    });
    [].forEach.call(document.querySelectorAll('dfn[id]'), function(definition) {
        definition.setAttribute('title', '#' + definition.id);
    });
});

}());