# a-menu custom element

A configurable, responsive, and lightweight web component for building nested menus, navigation bars, drop-downs, and accordions.

It uses native `<details>` and `<summary>` elements under the hood for built-in accessibility, and automatically adapts to mobile views based on a configurable breakpoint.

Demo: https://holmesbryant.github.io/a-menu/

## Features

- **Responsive Breakpoints:** Automatically converts complex horizontal navigations into vertical mobile menus when the viewport shrinks below the breakpoint.

- **Smart Nesting:** Placing an `<a-menu>` inside another automatically configures the child menu types (e.g., a classic top menu creates dropdown children, which in turn create flyout grandchildren).

- **Animated:** Smooth CSS height and opacity transitions using `interpolate-size: allow-keywords` where supported, with fallback transition handlers.

- **Configurable:** Each nested `<a-menu>` can have its own set of attributes/properties (including 'type'), so you can configure your menus however you need.

## Usage

Import the script in your HTML or JavaScript file.

```html
<!-- page.html -->
<script type="module" src="a-menu.min.js"></script>
```

```javascript
// script.js
import AMenu from './a-menu.js';
```

Then use the `<a-menu>` tag in your page.

**IMPORTANT** You must add the `open` attribute to your menu if you want it to be visible when the page loads. If you cannot see your menu, you may have forgotten to do this.

```html
<a-menu open>
  <b slot="label">Menu</b>

  <a href="/">Home</a>
  <a href="/about">About</a>

  <!-- Nested menus are supported automatically -->
  <a-menu>
    <b slot="label">Services</b>

    <a href="/web">Web Design</a>
    <a href="/seo">SEO</a>
  </a-menu>
</a-menu>
```

## Attributes & Properties

- **breakpoint:** (default: 600)
	- @type: number
	- The maximum width in pixels before switching to mobile view.

- **debug:** (default: false)
	- @type: boolean
	- Enables state and property logging to the console.

- **group:** (default: undefined)
	- @type: string
	- Assigning groups to menus creates accordion-like behavior between menus having the same group name.

- **open:** (default: false)
	- @type: boolean
	- Indicates if the menu is currently expanded.

- **show-icon:** (default: 'mobile, flyout, dropdown')
	- @type: comma separated string
	- Comma-separated list of menu types that display an icon.

- **top:** (default: it depends...)
	- @type boolean
	- Indicates if this is the top-level menu in a nested structure. This is set automatically. It is not normally set manually.

- **type:** (default "classic")
	- @type: string
	- The visual style type of the menu.
	- Possible values: 'classic', 'mobile', 'ribbon', 'dropdown', 'flyout', 'sitemap'

**Note:** Attributes reflect to properties and vice versa. If an attribute is hyphen-ated, its corresponding property is camelCase. For example, if the attribute is `show-icon`, the property is `showIcon`.

## Slots

- **label** The HTML displayed in the menu header/summary. `<b slot="label">My Label</b>`

- **icon** An icon displayed next to the label. By default, the icon is only visible on mobile, flyout, and dropdown types. If you want the icon to show on other types, include them in the value for `show-icon`. `<b slot="icon">!</b>`

## CSS Custom Properties

You can style `<a-menu>` by defining the following custom CSS variables in your stylesheet.

- **--amenu-duration**	(default: 400ms)	Transition duration for opening/closing animations (height and opacity).

- **--amenu-flex**	(default: 0) Sets flex on menu items. When set to 1, all items will be the same with. Only affects 'classic' and 'shingle' menus. When set to 1, it overrides `--amenu-justify`.

- **--amenu-justify** (default: center) Sets `justify-content` on elements containing the menu items. Only affects 'classic' and 'shingle' menus.

- **--amenu-min**	(default: 35px)	Minimum height for menu items.

- **--amenu-pad**	(default: 1rem) The horizontal padding of menu items.

## Theming

If you don't add additional css to theme your menus, they will look terrible. Included in the 'dist' folder is a stylesheet (a-menu.css) which will give you a good start. Just include that stylesheet in your html page.

## Chenge Log

- v1.5
- Changed developer dependencies.
- Fixed css issue where parts of long menus rendered incorrectly on short screens.

- v1.0 Initial commit.
