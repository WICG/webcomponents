document.addEventListener('DOMContentLoaded', function() {
    var title = document.querySelector('h2#editors-draft');
    if (title) {
        var date = new Date();
        title.appendChild(document.createTextNode(' ' + date.getDate() + ' ' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()] + ' ' + date.getFullYear()));
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
})