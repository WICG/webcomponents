(function() {

function getTitle(e) {
    var title = e.getAttribute("title") || e.innerText;
    return title.toLowerCase().replace(/^\s+/, "").replace(/\s+$/, "").split(/\s+/).join(" ");
};

function resolveAutolink() {
    if (!autolinkConfig)
        return;
    var definitionMap = {};
    for (var urlPrefix in autolinkConfig) {
        var titleToLink = autolinkConfig[urlPrefix];
        for (var title in titleToLink) {
            if (definitionMap[title.toLowerCase()]) {
                console.warn(title + ' is defined twice in autolinkConfig.');
            } else {
                definitionMap[title.toLowerCase()] = urlPrefix + titleToLink[title];
            }
        }
    }
    Array.prototype.slice.call(document.querySelectorAll("a:not([href])")).forEach(function (e) {
        if (e.classList.contains("internalDFN"))
            return;
        var title = getTitle(e);
        if (definitionMap[title]) {
            e.setAttribute("href", definitionMap[title]);
            e.classList.add("externalDFN");
        }
    });
}

document.addEventListener('DOMContentLoaded', resolveAutolink);

}());
