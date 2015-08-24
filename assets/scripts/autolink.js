
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
        var linkText = e.getAttribute("data-lt") || e.textContent;
        if (!linkText) return;
        linkText = linkText.toLowerCase().replace(/^\s+/, "").replace(/\s+$/, "").split(/\s+/).join(" ");
        if (definitionMap[linkText]) {
            e.setAttribute("href", definitionMap[linkText]);
            e.classList.add("externalDFN");
        }
    });
}
