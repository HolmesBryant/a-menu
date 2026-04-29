const sheet = new CSSStyleSheet();
          sheet.replaceSync("/* a-menu-shadow.css */:host { interpolate-size: allow-keywords; min-height: var(--amenu-min, 35px);}::slotted(*) { align-items: center; display: flex; flex: var(--amenu-flex, 0); min-height: var(--amenu-min, 35px); white-space: nowrap;}details { display: flex; height: 100%; position: relative; width: 100%;}details > #items { height: auto; max-height: 0; opacity: 0; overflow: hidden;}details.open > #items { max-height: 100svh; opacity: 1; overflow: visible; overflow-x: visible;}details.open > summary::before { transform: rotate(90deg);}summary { align-items: center; cursor: pointer; display: flex; flex: var(--amenu-flex, 0); height: 100%;}summary::before { align-items: center; content: \"▶\"; display: inline-flex; justify-content: center; transition: transform .25s;}summary.no-arrow::before { content: \"\";}.hidden,[hidden]{ display: none; }#label-wrapper { align-items: center; display: flex; flex: 1; height: 100%;}#icon { font-size: var(--amenu-min, 35px);}#items { display: flex; justify-content: var(--amenu-justify, center); overflow: auto; transition: height var(--amenu-duration, 400ms) ease-in-out, max-height var(--amenu-duration, 400ms) ease-in-out, opacity var(--amenu-duration, 400ms) 300ms;}@supports (interpolate-size: allow-keywords) { details > #items { height: 0; max-height: unset; } details.open > #items { height: auto; }}/* --- Classic --- */:host([type=\"classic\"]) { display: block; padding: 0;}:host([type=\"classic\"]) details { display: block; width: 100%;}:host([type=\"classic\"]) #items { flex-direction: row; flex-wrap: wrap; width: 100%;}/* --- Mobile --- */:host([type=\"mobile\"]) details { flex-direction: column;}:host([top][type=\"mobile\"]) summary { width: max-content;}:host([type=\"mobile\"]) #items { flex-direction: column; flex-wrap: nowrap; overflow-y: auto;}/* -- Shingle -- *//* Ensure the top-level menu acts as the positioning anchor for child panels */:host([type=\"shingle\"][top]) { flex-direction: row; position: relative;}/* Remove relative positioning from individual tabs so absolute #items escapes them */:host([type=\"shingle\"]) details { justify-content: var(--amenu-justify, center); position: static;}:host([type=\"shingle\"]) #items { justify-content: var(--amenu-justify, center); flex-direction: row; flex-wrap: wrap; position: absolute; left: 0; top: 100%; width: 100%;}/* --- Dropdown --- */:host([type=\"dropdown\"]) { display: inline-block;}:host([type=\"dropdown\"]) details { display: flex; flex-direction: column;}:host([type=\"dropdown\"]) #items { box-shadow: 0 4px 6px rgba(0,0,0,0.1); flex-direction: column; position: absolute; top: 100%;}/* --- Flyout --- */:host([type=\"flyout\"]) { display: inline-flex;}:host([type=\"flyout\"]) details { display: flex; flex-direction: column;}:host([type=\"flyout\"]) #items { box-shadow: 4px 4px 6px rgba(0,0,0,0.1); flex-direction: column; position: absolute; left: 100%; top: 0; width: max-content;}/* --- Sitemap --- */:host([type=\"sitemap\"]) { display: block; box-sizing: border-box; padding: 0; break-inside: avoid;}:host([type=\"sitemap\"][top]) { column-width: 200px; column-gap: 2rem; margin: 0; padding: 0; width: 100%;}:host([type=\"sitemap\"]) details { height: auto; flex-direction: column;}:host([type=\"sitemap\"]) summary { padding: 0; pointer-events: none;}:host([type=\"sitemap\"]) summary::before { content: \"\";}:host([type=\"sitemap\"]) #items { flex-direction: column; margin-left: calc(var(--amenu-pad, .5em) * 2.5);}");

/**
 * @file a-menu.js
 * @description A custom element that renders a configurable, responsive menu.
 * @author Holmes Bryant <Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 * @version 1.2
 */


const abindUpdate = Symbol.for('abind.update');

class AMenu extends HTMLElement {
  // -- Attributes --

  /** @type {number} The maximum width in pixels before switching to mobile view. */
  #breakpoint = 600;

  /** @type {string|undefined} The name of the group this menu belongs to for accordion-like behavior. */
  #group;

  /** @type {string[]} Comma-separated list of menu types that display an icon. */
  #showIcon = ['mobile', 'flyout', 'dropdown'];

  /** @type {boolean} Indicates if the menu is currently expanded. */
  #open = false;

  /** @type {boolean} Indicates if this is the top-level menu in a nested structure. */
  #top = false;

  /** @type {string} The visual style type of the menu (e.g., 'classic', 'mobile', 'shingle'). */
  #type = 'classic';

  // -- Private --

  /** @type {AbortController} Controller to manage event listener lifecycle. */
  #abortController;

  /** @type {boolean} Tracks if the element is appended to the DOM. */
  #connected = false;

  /** @type {boolean} Enables debug logging. */
  #debug = false;

  /** @type {boolean} Indicates if an icon is assigned to the icon slot. */
  #hasIcon = false;

  /** @type {boolean} Indicates if a label is assigned to the label slot. */
  #hasLabel = false;

  /** @type {HTMLElement} The span element wrapping the icon. */
  #icon;

  /** @type {HTMLSlotElement} The slot for the menu icon. */
  #iconSlot;

  /** @type {boolean} Prevents overlapping transition events during close. */
  #isClosing;

  /** @type {HTMLElement} The container for the menu items. */
  #items;

  /** @type {HTMLSlotElement} The default slot for menu content. */
  #itemsSlot;

  /** @type {HTMLSlotElement} The slot for the menu label. */
  #labelSlot;

  /** @type {boolean} Locks the menu type if defined by a parent menu. */
  #lockedType = false;

  /** @type {boolean} Whether info has already been logged. */
  #logged = false;

  /** @type {HTMLDetailsElement} The core details element serving as the menu. */
  #menu;

  /** @type {MediaQueryList} The active media query list for the responsive breakpoint. */
  #mql;

  /** @type {Function} The handler for media query changes. */
  #mqlHandler;

  /** @type {string|null} Stores the original 'open' value when temporarily switching to mobile */
  #originalOpen;

  /** @type {string|null} Stores the original type when temporarily switching to mobile. */
  #originalType;

  /** @type {HTMLElement} The summary element acting as the menu toggle. */
  #summary;

  /** @type {number|null} Timeout ID for closing transition fallback. */
  #transitionTimeout = null;

  // -- Static --

  /**
   * Global registry of menu groups mapped to sets of menu elements.
   * @type {Map<string, Set<AMenu>>}
   */
  static #menus = new Map();

  /**
   * Attributes to observe for changes.
   * @type {string[]}
   */
  static observedAttributes = [
    'breakpoint',
    'debug',
    'group',
    'open',
    'show-icon',
    'swipe',
    'top',
    'type'
  ];

  /**
   * The template representing the internal shadow DOM structure.
   * @type {HTMLTemplateElement}
   */
  static template = document.createElement('template');
  static {
    this.template.innerHTML = `
      <details part="menu" id="menu" role="group" aria-label="menu">
        <summary part="summary" id="summary" role="button" aria-expanded="false">
          <div id="label-wrapper">
            <span part="icon" id="icon">
              <slot name="icon"></slot>
            </span>

            <slot name="label"></slot>
          </div>
        </summary>

        <div part="items" id="items">
          <slot></slot>
        </div>
      </details>
    `;
  }

  /**
   * Creates an instance of AMenu, attaches the shadow DOM, and initializes selectors.
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(AMenu.template.content.cloneNode(true));
    this.shadowRoot.adoptedStyleSheets = [sheet];
    this.#menu = this.shadowRoot.getElementById('menu');
    this.#icon = this.shadowRoot.getElementById('icon');
    this.#iconSlot = this.shadowRoot.querySelector('slot[name="icon"]');
    this.#items = this.shadowRoot.getElementById('items');
    this.#itemsSlot = this.shadowRoot.querySelector('slot:not([name])');
    this.#labelSlot = this.shadowRoot.querySelector('slot[name="label"]');
    this.#summary = this.shadowRoot.querySelector('summary');
  }

  // -- Lifecycle --

  /**
   * Invoked when one of the custom element's observed attributes is added, removed, or changed.
   * @param {string} attr - The name of the changed attribute.
   * @param {string|null} oldval - The previous value of the attribute.
   * @param {string|null} newval - The new value of the attribute.
   */
  attributeChangedCallback(attr, oldval, newval) {
    if (oldval === newval) return;
    switch (attr) {
    case 'breakpoint':
      this.#breakpoint = (newval && !isNaN(parseFloat(newval))) ? parseFloat(newval) : null;
      this.#setupMediaQuery(newval);
      globalThis[abindUpdate]?.(this, 'breakpoint', newval);
      break;
    case 'debug':
      this.#debug = this.hasAttribute('debug');
      break;
    case 'group':
      this.#group = newval;
      if (oldval) {
        const oldSet = AMenu.#menus.get(oldval);
        oldSet?.delete(this);
        if (oldSet?.size === 0) AMenu.#menus.delete(oldval);
      }
      if (newval) AMenu.register(newval, this);
      globalThis[abindUpdate]?.(this, 'group', newval);
      break;
    case 'open':
      this.#open = this.hasAttribute('open');
      if (this.#connected) this.#toggleMenu();
      globalThis[abindUpdate]?.(this, 'open', this.#open);
      break;
    case 'top':
      this.#top = this.hasAttribute('top');
      globalThis[abindUpdate]?.(this, 'top', this.#top);
      break;
    case 'show-icon':
      this.#showIcon = newval ? newval.split(',').map( item => item.trim()) : [];
      if (this.#connected) {
        this.#maybeAddIcon();
        this.#maybeShowIcon();
        this.#maybeHideHeader();
      }
      globalThis[abindUpdate]?.(this, 'showIcon', this.#showIcon);
      break;
    case 'type':
      this.#type = newval;
      if (!this.#connected) return;
      if (this.#lockedType) return;
      if (oldval === 'sitemap' && !this.#top) this.open = false;
      this.#applyType(newval);
      globalThis[abindUpdate]?.(this, 'type', newval);
      break;
    }

    this.#logged = false;
    if (this.debug) this.logVars(true);
  }

  /**
   * Invoked each time the custom element is appended into a document-connected element.
   */
  connectedCallback() {
    this.#connected = true;
    if (this.id) this.#menu.dataset.parent = this.id;
    this.#abortController = new AbortController();

    if (this.parentElement?.closest('a-menu') === null) {
      this.top = true;
    }

    if (this.parentElement?.closest('a-menu') !== null && this.hasAttribute('type') ) {
      this.#lockedType = true;
    }

    this.#hasLabel = this.#labelSlot.assignedElements().length > 0;
    // this.#hasIcon = this.#iconSlot.assignedElements().length > 0;
    this.#maybeAddIcon();
    if (this.#group) AMenu.register(this.#group, this);

    this.#applyType(this.#type);
    this.#addListeners();
    this.#setupMediaQuery(this.breakpoint);
    if (this.#open) this.#toggleMenu();
  }

  /**
   * Invoked each time the custom element is disconnected from the document's DOM.
   */
  disconnectedCallback() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    if (this.#group) {
      const groupSet = AMenu.#menus.get(this.#group);
      if (groupSet) {
        groupSet.delete(this);
        if (groupSet.size === 0) AMenu.#menus.delete(this.#group);
      }
    }

    if (this.#mql && this.#mqlHandler) {
      this.#mql.removeEventListener('change', this.#mqlHandler);
    }

    if (this.#transitionTimeout) {
      clearTimeout(this.#transitionTimeout);
      this.#transitionTimeout = null;
      this.#isClosing = false;
    }
  }

  // -- Private --

  /**
   * Attaches event listeners for clicks, slot changes, and touch gestures.
   * @private
   */
  #addListeners() {
    this.addEventListener('click', (event) => {
      const path = event.composedPath();
      if (path.includes(this.#summary)) {
        event.preventDefault();
        event.stopPropagation();
        this.open = !this.open;
      } else {
        const link = event.target.closest('a');
        if (link) this.open = false;
      }
    }, { signal:this.#abortController.signal });

    this.#labelSlot.addEventListener('slotchange', () => {
      this.#handleSlotChange(); },
      { signal: this.#abortController.signal });

    this.#iconSlot.addEventListener('slotchange', () => {
      this.#handleSlotChange; },
    { signal: this.#abortController.signal });

    // Listener for the "Back" gesture/button
    window.addEventListener('popstate', (event) => {
      // If the user goes back, close the menu
      this.open = false;
    });
  }

  /**
   * Applies the specified visual type to the menu, handling overrides and header visibility.
   * @param {string} value - The menu type to apply.
   * @private
   */
  #applyType(value) {
    if (this.#lockedType) return;

    const types = ['mobile', 'classic', 'shingle', 'dropdown', 'flyout', 'sitemap'];
    for (const type of types) {
      if (type !== value && this.hasAttribute(type)) {
        this.removeAttribute(type);
      }
    }
    // Guard: Only set attribute if different to prevent infinite recursion
    if (this.getAttribute('type') !== value) {
      this.setAttribute('type', value);
      return; // Stop here, attributeChangedCallback will call applyType again
    }

    if (value === 'sitemap') {
      this.open = true;
    }

    this.#applyTypeToNested(value);
    this.#maybeAddIcon();
    this.#maybeHideHeader();
    this.#maybeShowIcon();
  }

  /**
   * Asynchronously cascades the appropriate menu type to nested sub-menus.
   * @param {string} value - The parent menu type.
   * @returns {Promise<void>}
   * @private
   */
  async #applyTypeToNested(value) {
    if (!this.isConnected) return;
    await customElements.whenDefined('a-menu');
    await Promise.resolve();

    if (!this.isConnected) return;

    const nested = Array.from(this.children).filter(item => item.localName === 'a-menu');
    if (!nested.length) {
      if (this.debug) this.logVars();
      return;
    }

    for (const child of nested) {
      let type = value;
      if (this.#type === 'classic') type = 'dropdown';
      if (this.#type === 'dropdown') type = 'flyout';
      if (child.type !== type) child.type = type;
    }

    if (this.debug) this.logVars();
  }

  /**
   * Closes other menus within the same designated group to ensure accordion-like behavior.
   * @param {AMenu} elem - The current menu element triggering the action.
   * @param {string} group - The group identifier.
   * @private
   */
  #closeOthers(elem, group) {
    const set = AMenu.#menus.get(group);
    if (!set) return console.warn(`the group "${group}" was not registered.`);
    for (const menu of set) {
      if (menu === elem) continue;
      if (menu.open) menu.open = false;
    }
  }

  /**
   * Closes the menu while waiting for CSS transitions to complete, guarding against event overlaps.
   * @param {HTMLDetailsElement} menu - The details element to close.
   * @param {HTMLElement} elem - The items container with the transition.
   * @private
   */
  async #closeWithTransition(menu, elem) {
    if (this.#isClosing) return;
    this.#isClosing = true;

    menu.classList.remove('open');
    const animations = await elem.getAnimations();
    let duration = 0;

    for (const anim of animations) {
      duration = Math.max(duration, anim.effect.getComputedTiming().endTime);
    }

    const fallbackDelay = duration > 0 ? duration : 1000;
    let isClosed = false;

    const closeMenu = (event) => {
      if (event && event.target !== elem) return;
      if (isClosed) return;

      isClosed = true;
      this.#isClosing = false;
      menu.open = false;
      this.#summary.setAttribute('aria-expanded', 'false');
      elem.removeEventListener('transitionend', closeMenu);
      clearTimeout(this.#transitionTimeout);
      this.#transitionTimeout = null;
    };

    elem.addEventListener('transitionend', closeMenu);
    this.#transitionTimeout = setTimeout(closeMenu, fallbackDelay);
  }

  #handleSlotChange() {
    this.#hasLabel = this.#labelSlot.assignedElements().length > 0;
    this.#maybeAddIcon();
    this.#maybeHideHeader();
    this.#maybeShowIcon();
  }

  #maybeAddIcon() {
    const hasAssigned = this.#iconSlot.assignedElements().length > 0;
    const needsFallback = this.#top && !hasAssigned && this.#showIcon.includes(this.#type);
    if (needsFallback) {
      if (!this.#iconSlot.firstElementChild) {
        this.#iconSlot.innerHTML = '<strong>&equiv;</strong>';
      }
      this.#hasIcon = true;
    } else {
      if (!hasAssigned && this.#iconSlot.firstElementChild) {
        this.#iconSlot.innerHTML = '';
      }
      this.#hasIcon = hasAssigned;
    }
  }

  /**
   * Hides the menu header (summary) if neither a label nor an icon is present.
   * @private
   */
  #maybeHideHeader() {
    this.#summary.hidden = !this.#hasLabel && !this.#hasIcon;
  }

  /**
   * Evaluates whether the icon should be displayed based on slot assignment and menu type.
   * @returns {boolean} True if the icon is shown, false otherwise.
   * @private
   */
  #maybeShowIcon() {
    const show = this.#hasIcon && this.showIcon.includes(this.type);
    if (show) {
      this.#icon.classList.remove('hidden');
      this.#summary.classList.add('no-arrow');
    } else {
      this.#icon.classList.add('hidden');
      if (this.#top) {
        this.#summary.classList.add('no-arrow');
      } else if (this.#type !== 'sitemap') {
        this.#summary.classList.remove('no-arrow');
      }
    }
  }

  /**
   * Initializes the media query listener for responsive behavior based on the breakpoint.
   * @param {number|string} maxWidth - The maximum width in pixels for the media query.
   * @private
   */
  #setupMediaQuery(maxWidth) {
    if (!this.#top) return;
    if (this.#mql && this.#mqlHandler) {
      this.#mql.removeEventListener('change', this.#mqlHandler);
    }

    if (!maxWidth) return;
    this.#mql = window.matchMedia(`(max-width: ${maxWidth}px)`);

    this.#mqlHandler = (event) => {
      if (event.matches) {
        if (this.type !== 'mobile') {
          this.#originalType = this.type;
          this.type = 'mobile';
          this.#originalOpen = this.open;
          this.open = false;
        }
      } else {
        // screen is larger
        if (this.#originalType && this.type === 'mobile') {
          this.type = this.#originalType;
          this.open = this.#originalOpen;
          this.#originalType = null;
          this.#originalOpen = null;
        }
      }
    };

    this.#mql.addEventListener('change', this.#mqlHandler);
    this.#mqlHandler(this.#mql);
  }

  /**
   * Toggles the open state of the core details element and manages grouped menus.
   * @private
   */
  #toggleMenu() {
    if (this.#open && !this.#menu.open) {
      this.#menu.open = true;
      this.#menu.classList.add('open');
      this.#summary.setAttribute('aria-expanded', 'true');
      window.history.pushState({ menuOpen: true }, '');
      if (this.#group && this.type !== 'sitemap') this.#closeOthers(this, this.#group);
    } else if (!this.open && this.#menu.open) {
      this.#closeWithTransition(this.#menu, this.#items);
    }
  }

  // -- Public --

  /**
   * Logs the internal state and properties of the element to the console.
   * @param {boolean} [isOpen=false] - Whether to expand the console group by default.
   */
  logVars(isOpen = false) {
    if (this.#logged) return;
    if (isOpen) {
      console.group(this);
    } else {
      console.groupCollapsed(this);
    }

    console.log('------ Attributes ------');
    console.log('breakpoint :', this.breakpoint);
    console.log('group :', this.group);
    console.log('showIcon :', this.showIcon);
    console.log('open :', this.open);
    console.log('swipe :', this.swipe);
    console.log('top :', this.top);
    console.log('type :', this.type);

    console.log('------ Properties ------');
    console.log('#connected :', this.#connected);
    console.log('#hasIcon :', this.#hasIcon);
    console.log('#hasLabel :', this.#hasLabel);
    console.log('#lockedType :', this.#lockedType);
    console.log('#mql :', this.#mql);
    console.log('#originalType :', this.#originalType);

    console.log('------ CSS Variables ------');
    const computed = window.getComputedStyle(this);
    console.log('--amenu-background', computed.getPropertyValue('--amenu-background'));
    console.log('--amenu-text', computed.getPropertyValue('--amenu-text'));
    console.log('--amenu-border', computed.getPropertyValue('--amenu-border'));
    console.log('--amenu-accent', computed.getPropertyValue('--amenu-accent'));
    console.log('--amenu-min', computed.getPropertyValue('--amenu-min'));
    console.log('--amenu-pad', computed.getPropertyValue('--amenu-pad'));
    console.log('--amenu-duration', computed.getPropertyValue('--amenu-duration'));
    console.log('--amenu-justify', computed.getPropertyValue('--amenu-justify'));
    console.log('--amenu-flex', computed.getPropertyValue('--amenu-flex'));

    console.groupEnd();
    this.#logged = true;
  }

  /**
   * Registers a menu instance to a specific accordion group.
   * @param {string} group - The group identifier.
   * @param {AMenu} elem - The menu instance to register.
   */
  static register(group, elem) {
    if (!this.#menus.has(group)) this.#menus.set(group, new Set());
    this.#menus.get(group).add(elem);
  }

  // -- Getters / Setters --

  /**
   * Gets or sets the maximum width breakpoint for mobile view.
   * @type {number|null}
   */
  get breakpoint() { return this.#breakpoint }
  set breakpoint(value) {
    if (value && isNaN(parseFloat(value))) {
      console.warn(`breakpoint value must be a number. Value given was: {${typeof value}} ${value}`);
      return;
    }

    if (value) {
      this.setAttribute('breakpoint', value);
    } else {
      this.removeAttribute('breakpoint');
    }
  }

  /**
   * Gets or sets the debug logging state.
   * @type {boolean}
   */
  get debug() { return this.#debug }
  set debug(value) {
    value = value != null && String(value) !== "false";
    this.toggleAttribute('debug', value);
  }

  /**
   * Gets or sets the group name for accordion functionality. Setting to null removes the attribute.
   * @type {string|undefined}
   */
  get group() { return this.#group }
  set group(value) {
    if (value == null) {
      this.removeAttribute('group');
    } else {
      this.setAttribute('group', value);
    }
  }

  /**
   * Gets or sets the open state of the menu.
   * @type {boolean}
   */
  get open() { return this.#open }
  set open(value) {
    value = value != null && String(value) !== 'false';
    this.toggleAttribute('open', value);
  }

  /**
   * Gets the comma-separated list of types that permit icons.
   * @type {string[]}
   * @readonly
   */
  get showIcon() { return this.#showIcon }

  /**
   * Sets the 'show-icon' attribute.
   * @param {string} value - A comma separated list of menu types for which to show the icon.
   */
  set showIcon(value) {
    if (value == null) {
      this.removeAttribute('show-icon');
    } else {
      this.setAttribute('show-icon', value);
    }
  }

  /**
   * Gets or sets whether this is a top-level menu.
   * @type {boolean}
   */
  get top() { return this.#top }
  set top(value) {
    value = value != null && String(value) !== "false";
    this.toggleAttribute('top', value);
  }

  /**
   * Gets or sets the layout type of the menu. Setting to null removes the attribute.
   * @type {string}
   */
  get type() { return this.#type }
  set type(value) {
    if (value == null) {
      this.removeAttribute('type');
    } else {
      this.setAttribute('type', value);
    }
  }
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);

export { AMenu as default };
