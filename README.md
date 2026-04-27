# a-menu custom element

A configurable, responsive, and lightweight web component for building nested menus, navigation bars, drop-downs, and accordions.

It uses native `<details>` and `<summary>` elements under the hood for built-in accessibility, and automatically adapts to mobile views based on a configurable breakpoint.

## Features

- **Responsive Breakpoints:** Automatically converts complex horizontal navigations into vertical mobile menus when the viewport shrinks below the breakpoint.

- **Smart Nesting:** Placing an `<a-menu>` inside another automatically configures the child menu types (e.g., a classic top menu creates dropdown children, which in turn create flyout grandchildren).

- **Touch Friendly:** Built-in swipe gesture recognition for opening and closing.

- **Animated:** Smooth CSS height and opacity transitions using modern interpolate-size: allow-keywords where supported, with fallback transition handlers.

- **Configurable:** Each nested `<a-menu>` can have its own set of attributes/properties (including 'type'), so you can configure your menus however you need.

## Usage

Import the script in your HTML or JavaScript file, then use the `<a-menu>` tag.

**Note** If you want the menu to be open when the page loads, you must add the `open` attribute. If you cannot see your menu, you may have forgotten to do this.

```html
<script type="module" src="a-menu.min.js"></script>

<a-menu open>

  <span slot="icon">&equiv;</span>
  <span slot="label">Menu</span>

  <a href="/">Home</a>
  <a href="/about">About</a>

  <!-- Nested menus are supported automatically -->
  <a-menu>
    <span slot="label">Services</span>
    <a href="/web">Web Design</a>
    <a href="/seo">SEO</a>
  </a-menu>
</a-menu>
```

## Attributes & Properties

- **type:** (default "classic")
	- @type: String
	- possible values: 'classic', 'mobile', 'ribbon', 'dropdown', 'flyout', 'sitemap'
	- The layout style

- **breakpoint:** (default: 600)
	- @type: Number
	- Max width (in pixels) before the menu automatically switches to mobile view.

- **group:**
	- @type: String
	- Assigning a group name creates accordion-like behavior (only one menu in the group can be open at a time).

- **open** (default: it depends...)
	- @type: Boolean
	- Indicates whether the menu is currently expanded. Does not have a value, its presence alone triggers the effect.
	- An `<a-menu>` opens automatically: when the open attribute is explicitly present on the element, when its type is set to 'sitemap' (which forces menus to remain expanded), or when it is a top-level menu (top is true) and it lacks a slotted label, forcing it to expand since there is no clickable header to toggle its state.

- **swipe:** (default: 40)
	- @type: Number
	- Minimum vertical touch swipe distance (in pixels) required to toggle the menu.

- **top:** (default: false)
	- @type: Boolean
	- Indicates if this is a top-level menu. Automatically set to true if no parent `<a-menu>` is detected. Does not have a value, its presence alone triggers the effect.

- **debug:** (default: false)
	- @type: Boolean
	- Enables state and property logging to the console. Does not have a value, its presence alone triggers the effect.

**Note:** Attributes reflect to properties and vice versa.

## Slots

- **label** The text or HTML displayed in the menu header/summary.

- **icon** An icon displayed next to the label. (Only visible on mobile, flyout, and dropdown types by default).

## CSS Custom Properties

You can style `<a-menu>` by defining the following custom CSS variables in your stylesheet.

- **--amenu-min**	(default 35px)	Minimum height for the menu header and menu items.

- **--amenu-flex**	(default: center)	Flexbox alignment for slotted items and horizontal justification.

- **--amenu-duration**	(default: 400ms)	Transition duration for opening/closing animations (height and opacity).

- **--amenu-pad**	(default: 1rem)	The horizontal padding or left margin indentation applied to all menu items, depending on type.

