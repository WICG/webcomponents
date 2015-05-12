# Distribution Timing Experiment

#### by Dimitri Glazkov

The main concern with microtask checkpoint timing of the distribution API callbacks is explained on the main [Imperative API](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/Imperative-API-for-Node-Distribution-in-Shadow-DOM.md#api-for-triggering-distribution) page. The following experiment aims to provide data on the amount and type of breakages the asynchronous timing would cause in the wild.

## The Setup

I took the [nope-js](https://github.com/dglazkov/nope-js) project as a starting point. This project has the goal of providing strong hints to developers on the choice of their APIs and their timing. For example, in unmodified version, calling `document.write` throws an exception.

As one of the hints, the library introduces a DOM **read** and DOM **write** lifecycle stages to the document. The idea is that the developer should explicitly state whether they intend to read the state of the DOM (and its effects, such as computed style information and layout data), write to it, but never both at the same time. In the **write** mode (default), all of the methods and accessors that cause synchronous layout or style computation throw an exception.

To facilitate exploration, there's an [extension](https://github.com/dglazkov/nope-js/blob/master/extension/chrome/content_script.js) (Chrome only at this point) that enables the user to surf the Web with all hints turned on.

For this experiment, I took the extension and [modified it](https://github.com/dglazkov/nope-js/blob/lie/extension/chrome/content_script.js). In particular, instead of throwing exceptions, the modified version attempts to approximate the effects of synchronously computing style and layout *before* the distribution callback was invoked.

The scenario of concern is that the child of a shadow host haven't yet been distributed into any insertion points at the time of invoking the API that triggers synchronous layout/style computation. In this case, the resulting effects roughly break down into 3 categories:

* [The property returns 0](https://github.com/dglazkov/nope-js/blob/lie/extension/chrome/content_script.js#L122)
* [The property/method returns an empty ClientRect](https://github.com/dglazkov/nope-js/blob/lie/extension/chrome/content_script.js#L129)
* [The method does nothing](https://github.com/dglazkov/nope-js/blob/lie/extension/chrome/content_script.js#L136)

To simulate these effects, the extension simply "lies" whenever asked about layout/style data. This is not a 100% accurate approximation, but it provides enough sense on the type of things that would break if a third-party Web Component is added to an existing site.

To install the modified extension:

* Clone [nope-js](https://github.com/dglazkov/nope-js) git repo locally
* Switch the local repo to the `lie` branch
* Open Chrome (M43+ is required) with a [clean profile](https://developer.chrome.com/devtools/docs/clean-testing-environment)
* Go to `http://chrome/extensions` and check **Developer mode**
* Click **Load unpacked extension...** and point the file picker to `extension/chrome` directory in the `nope-js` repo.

## The Results

After installing the extension, I poked around the Web and looked for changes in appearance and behavior. The console output also provided an overview and extent of "lying".

Here are some things found in the first few minutes:

* [BBC News](http://www.bbc.com/) layout is [broken](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSVXdsZ1VOWUtVa28/edit) (compare with the [original](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSU3VGZnFVT2ZMd2c/edit)) and menu no longer functions (simply jumps to the bottom of the page)
* Graphics on [BBC News](http://www.bbc.com/) are very [low resution](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSalJsN3kxZWlfNjg/edit).
* The majority of links is missing from [CNN](http://cnn.com/) and [replaced with an ad](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vScTZqUGpnMHlMZ1k/edit) in the center of the page.
* [MSNBC](http://www.msnbc.com/) article layout is [broken](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSZjIwM3YtakFYTkU/edit) (compare with the [original](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSOGxxVEpjc0o0WFU/edit)).
* The images on [The Verge](http://www.theverge.com/) [article page](http://www.theverge.com/2015/5/12/8592639/self-driving-truck-daimler-freightliner) are [missing](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSN3lzRm1KcEVXZmc/edit) and the gaps they create are much larger than necessary.
* The background images on [The Verge](http://www.theverge.com/) are [missing](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSYmVRMUl3VmpJTUE/edit).
* [Wikipedia](http://en.wikipedia.org/wiki/Cat) works, but has subtle regressions, like incorrect positioning of the [autocompletion menu](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vSNUpDWmVpeTRxVVU/edit).
* [Youtube](https://www.youtube.com/) has various minor visual regressions (like the [missing video thumbnails](https://docs.google.com/a/chromium.org/file/d/0B2q0X4lip6vScnV3TC05NU55eDg/edit)).

## Conclusion

Even within minutes of surfing, it is easy to conclude that the effect of incorrect layout/style data causes the majority of popular Web pages to look   varying degrees of wrong and do slightly wrong things.

While it is unlikely that using asynchronous timing for distribution API callbacks will result in changes this dramatic, it is probable that the asynchronous timing will cause good percentage of breakages, making adoption of third-party Web Components a high-risk proposition.

