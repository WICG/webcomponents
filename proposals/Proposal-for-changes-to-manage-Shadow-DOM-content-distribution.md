# Summary

This document considers real-world usage of Shadow DOM in three large production component libraries, and identifies a number of issues with the current Shadow DOM design. This document proposes to address those issues by updating the Shadow DOM spec to:

1. Allow elements to identify insertion points by name rather than a CSS selector.
2. Support standard subclassing semantics by which a subclass can populate a named base class’ insertion point, and optionally expose an insertion point with the same name.

Significantly, these changes are compatible with the notion of supporting a maximum of one shadow root per element.

This document is not intended to be a complete, final proposal for a spec change. Rather, it is intended primarily to stimulate discussion at the Web Components Face-to-Face meeting on April 24, 2015.

# Some issues with the current Shadow DOM spec

Thanks to early work by Google’s Blink and Polymer teams, developers have now had 3 years of opportunity to create web components. Generally speaking, Shadow DOM is showing itself to be a useful way of encapsulating functionality that can be easily added to a web page without fear of interference between the component and page. That said, a number of issues have become apparent as people have attempted to use the spec’ed design to create non-trivial component libraries.

The following comments are based on analysis of three public web component libraries: Polymer’s core- elements, Polymer’s paper- elements, and the Basic Web Components’ collection of basic- elements. Collectively, these libraries contain over 100 non-trivial web components that attempt to deliver meaningful functionality to a broad audience, and they represent the state of the art in web component design.

1. The spec’ed ability to include default content in a <shadow> element is never used. In the three component libraries described above, not one component intended for public use uses this feature of `<shadow>`.

2. The `<shadow>` element is optimized for wrapping a base class, not filling it in. In practice, no subclass ever wants to wrap their base class with additional user interface elements. A subclass is a specialization of a base class, and specialization of UI generally means adding specialized elements in the middle of a component, not wrapping new elements outside some inherited core.

  In the three component libraries described above, the only cases where a subclass uses `<shadow>` is if the subclass wants to add additional styling. That is, a subclass wants to override base class styling, and can do so via:

  ```
  <template>
    <style>subclass styles go here</style>
    <shadow></shadow>
  </template>
  ```

  One rare exception is [core-menu](https://www.google.com/url?q=https%3A%2F%2Fgithub.com%2FPolymer%2Fcore-menu%2Fblob%2Fmaster%2Fcore-menu.html&sa=D&sntz=1&usg=AFQjCNH0Rv14ENbplb6VYWFh8CsfVo9m_A), which does add some components in a wrapper around a `<shadow>`. However, even in that case, the components in question are instances of `<core-a11y-keys>`, a component which defines keyboard shortcuts. That is, the component is not using this wrapper ability to add visible user interface elements, so the general point stands.

  As with the above point, the fact that no practical component has need for this ability to wrap an older shadow tree suggests the design is solving a problem that does not, in fact, exist in practice.

3. Components rarely (never?) take advantage of the ability to use CSS selectors to distribute non-contiguous content to insertion points. The `<content>` element permits a `select="h1"` attribute that gathers all `<h1>` elements (perhaps interleaved with other elements) and distributes that set to that insertion point. In practice, this is not especially useful.

  In the three libraries, the most common `select` clause is referencing a CSS class with the intention of using that CSS class name as a property name. In such cases, the `select` clause takes a CSS class name, not necessarily to take advantage of CSS features, but to implement a convention. The convention is working around the limitation that content cannot be selected by name.

  Alternatively, a number of core- and paper- elements use a select clause with a plain, named attribute, again with the intention of trying to designate a name for an insertion point. E.g., [core-drawer-panel](https://github.com/Polymer/core-drawer-panel/blob/master/core-drawer-panel.html) uses `<content select="[drawer]">` pulls a single light DOM child element with a plain `drawer` attribute into the drawer panel. Here we see a competing convention trying to achieve the same result as using a CSS class name — both are trying to specify to stick an element into an insertion point by name.

  Using CSS selectors to manage content distribution may support use cases that do not appear to come up often in practice. Meanwhile, the very flexibility of offering CSS selectors is producing competing conventions that are trying to fulfill an underlying need which is not being met directly.

4. A component cannot define a specific insertion points with `select` clauses that distributes nodes after a general `<content>` insertion point with no `select` clause. E.g., a page template component wants to define page header and footer elements that appear respectively above and below a general main region:

  ```
  <template>
    <content select=".header"></content>
    <content></content>
    <content select=".footer"></content>
  </template>
  ```

  Unfortunately, a page template cannot be constructed this way: the general `<content>` element with no `select` attribute will pick up all content not previously distributed — including the footer.

  This issue has come up multiple times in practice, and places non-trivial constraints on the UI which can be constructed with web components. While DOM content can be moved out of document order using, e.g., CSS Regions, that spec is not yet widely supported, and in any event is a cumbersome solution to a common need. (Discussion on a Shadow DOM [bug](https://www.google.com/url?q=https%3A%2F%2Fwww.w3.org%2FBugs%2FPublic%2Fshow_bug.cgi%3Fid%3D22268&sa=D&sntz=1&usg=AFQjCNEPVbdZAhdYVRQcQrO3kvotzks0OA) has proposed some ways of addressing this problem, but there has been no action on that.)

5. Component subclasses cannot fill in insertion points defined by their base classes. This hinders the creation of well-factored component class libraries. This issue is examined in an example below. As a practical effect of this limitation, none of the three of the component class libraries discussed here make significant use of subclassing. In nearly all interesting cases, the libraries are forced to extend a base class’ behavior by composing an instance of it, rather than inheriting from the base class.

  This goes against long experience in client user interface class library design (Windows Presentation Foundation, Apple Cocoa, to name just two), where subclassing is a fundamental means of carefully separating UI concerns.

  Because Shadow DOM does not support this feature, the three existing web component libraries discussed cannot be used as a reference point. Since the desired level of subclassing isn’t supported, it’s not possible to count how many times these libraries would have taken advantage of it.

  To provide some concrete data regarding this feature, an earlier general-purpose component library called [QuickUI](http://www.google.com/url?q=http%3A%2F%2Fquickui.org%2Fcatalog%2F&sa=D&sntz=1&usg=AFQjCNELVo-WYvHN0NWtatvYNtzry8ZGyg) was analyzed. This library, the predecessor to the Basic Web Components library, had ample support for subclassing. QuickUI’s class library contained 94 components, of which 36 are subclasses of another class. Of those 36, 12 components were subclasses that populated insertion points defined by a base class. So approximately ⅓ of the components used subclasses, and ⅓ of those filled in base class insertion points. QuickUI’s base class library contained only general-purpose components, and it is typically proprietary specializations of general components that most need the ability to fill in base class insertion points. Applications building on top of general-purpose components will likely see a higher portion of their app-specific components use subclassing.

It would be ideal if these issues could be addressed while preserving the core value of Shadow DOM.

# Combo Box: an example where component subclassing is desired

The above point raises the issue that the current Shadow DOM spec does not support web component subclasses that can partially or completely fill in base class insertion points. Component class hierarchies are useful in a variety of situations. To take just one, consider a simple combobox component:

![date combo box](https://raw.githubusercontent.com/wiki/w3c/webcomponents/resources/date-combo-box.png)

This combo box example has multiple insertion points:

1. An icon or label that goes in the push button (here, an orange calendar icon)
2. The contents of the combo box’s dropdown (here, a calendar)
3. The input element used for the text input portion (here, a date picker).

This type of combo box is extremely common in Mac and Windows client UIs, but relatively rare in web UIs — precisely because of the complexity entailed in getting the details right.

One would like to be able to define a general purpose `<combo-box>` component that handles the opening/closing and positioning of the dropdown. One would then like to be able to define subclasses that extend this <combo-box> to create specialized combo boxes like a `<date-combo-box>`, `<color-combo-box>`, and so on. Unfortunately, the Shadow DOM spec does not directly support common situations such as this.

For a brief period of time, it was possible in Blink for a subclass to distribute nodes to insertion points defined by a base class by placing elements (including `<content>`) inside a `<shadow>` element:

```
<template>
  <shadow>
    <p>
      Here’s some stock text that will be added to the content
      below. All these nodes will be picked up by the base class’
      content insertion point(s).
    </p>
    <content></content>
  </shadow>
</template>
```

However, this feature was rolled back due to implementation challenges.

# Proposal, part 1: Syntax for named insertion points

To address the issues raised above, we propose two changes. First, deprecate the `<content>` element’s `select` attribute as the declarative syntax for designating which DOM nodes should be distributed to an insertion point. Instead, indicate distribution with a new attribute that names an insertion point.

_**Disclaimer:** In this proposal, the attribute for defining the name is called “slot”. The word “slot” is used both in the name of an attribute on the `<content>` element, and as an attribute (`content-slot`) for designating the insertion point to which an element should be distributed. The word “slot” should just be considered a placeholder. it could just as easily be called “name”, “parameter”, “insertion-point”, or something similar. We should focus first on the intent of the proposal and, if it seems interesting, only then tackle naming._

Using the combo box example presented earlier, the three insertion points for a base `<combo-box>` component could be defined as follows:

```
<!-- For base combo-box class -->
<template>
  <style>… styles go here …</style>
  <div id="topPortion">
    <content slot="inputElement">
      <input type="text”>
    </content>
    <button id="dropdownButton">
      <content slot="icon">
        <img src="downArrow.png">
      </content>
    </button>
  </div>
  <div id="dropdownPortion">
    <content slot="dropdown">
      <!-- Base class doesn’t define choices that go in the dropdown. -->
    </content>
  </div>
</template>
```

A component instance can designate which light DOM children should be distributed to those named insertion points by referencing the named slot. This is done with an attribute, here tentatively named “content-slot”:

```
<combo-box>
  <img content-slot=”icon”>
  <div content-slot="dropdown">
    … Choices go here …
  </div>
</combo-box>
```

A component can provide a default `<content>` insertion point by omitting the `slot` attribute. (This is the same as omitting a `select` attribute in the current design.) Any light DOM children without an explicit `content-slot` attribute will be distributed to that default insertion point.

This portion of the proposal improves upon the current convention of using a named CSS class in a `select` attribute:

1. Explicitly naming insertion points better matches real-world use of `<content>` elements. That is, it replaces a loose convention (using a CSS class as a way to name an insertion point) with an explicit form. This should make component markup more consistent and predictable.
2. Naming an insertion point is arguably easier to understand than using CSS selectors (or, more precisely, the subset of CSS selectors which are permissible in a `select` attribute) to designate content distribution.
3. This approach opens up the chance for a subclass to override an insertion point, as described below.

# Proposal, part 2: Filling and re-exposing named insertion points

The second proposed change is to allow subclasses to populate named insertion points defined by their base classes. This is analogous to the standard ability in object-oriented languages for a class to set or override a base class property.

Continuing the combo box example, consider a subclass called `<date-combo-box>` that wants to extend the base `<combo-box>` component. It wants to fill in the base `<combo-box>` insertion points with some more specific content. It wants to use:

* A date input element for the input portion.
* A calendar icon for the button icon
* A calendar for the dropdown set of choices.

To support this common scenario, a subclass should be able to partially or completely fill in an insertion point defined by a base class. Several syntax approaches are possible. One declarative syntax would use the same proposed syntax for component instantiation shown earlier, in which elements are tagged with a `content-slot` attribute:

```
<!-- For date-combo-box, which inherits from combo-box -->
<template>
  <input type="date" content-slot="inputElement">
  <img src="calendarIcon.png" content-slot="icon">
  <month-calendar content-slot="dropdown"></month-calendar>
</template>
```
Or, an imperative syntax:

```
/* date-combo-box.js */
var dateTemplate = document.querySelector(“#dateTemplate”);
var dateTree = dateTemplate.content.cloneNode(true);
this.shadowRoot.addToPool(dateTree);
```

Here, `addToPool` (name TBD) is a way to populate the pool of children from the subclass.

In this approach, the subclass’ template is cloned to create a tree that is not (necessarily) a separate shadow tree rendered in the document. Rather, it could simply be an internal tree used as a source for elements which are distributed to a single shadow tree created by the base class. Among other things, this internal subclass’ tree would not participate in matters such as event handling — only the single rendered tree would handle events.

An alternative declarative syntax would require a subclass to define separate templates for each content slot they wish to fill:

```
<template content-slot="inputElement">
  <input type="date">
</template>
<template content-slot="icon">
  <img src="calendarIcon.png">
</template>
<template content-slot="dropdown">
  <month-calendar></month-calendar>
</template>
```

An alternative imperative syntax would permit a subclass to directly assign content (e.g., cloned from a template) to a named insertion point using an addToSlot() function:

```
var inputElementTemplate = document.querySelector('#dateComboBoxInput');
this.shadowRoot.addToSlot(‘inputElement’,
    inputElementTemplate.content.cloneNode(true));
```

For the time being, the main point here is not the precise syntax, but rather what it permits. The syntax should allow a subclass to fill in a base class insertion point and then re-expose an insertion point with the same name. Instances of this subclass would then distribute the content to that overridden insertion point.

For example, a new subclass of `<combo-box>` may wish to populate the dropdown slot with some stock text, and then re-expose that same named insertion point:

```
<!-- For a combo-box subclass that adds stock text to the dropdown. -->
<template>
  <div content-slot="dropdown">
    Here are your choices:
    <content slot="dropdown"></content>
  </div>
</template>
```

This ability to override a base class insertion point would permit web component classes that have the full range of expression possible in most object-oriented languages. This should facilitate a proper separation of user interface concerns.

# Conclusion

The changes proposed here will better align Shadow DOM with common, real-world scenarios encountered in the past three years of experience building production component libraries. It will remove support for some things that were possible, but which were not used in practice. These changes will also enable subclassing in web components as a fundamental means of achieving a good separation of user interface concerns.

These changes can be accomplished without the need to support multiple shadow roots on a single element. Dropping that requirement would permit simplification of the Shadow DOM design, making it easier for browser vendors to support and maintain a Shadow DOM implementation.

***

Contributors: Jan Miksovsky, Ryosuke Niwa, Edward O'Connor