import styles from './a-menu-shadow.css' with {type: 'css'};

export default class AMenu extends HTMLElement {
  // -- Attributes --
  _breakpoint = 768;
  _group;
  _showIcon = "mobile, flyout, dropdown";
  _open = false;
  _justify = "center";
  _top = false;
  _type = 'classic';

  // -- Private --

  _abortController;
  _applyNestedTimeout;
  _connected;
  _debug = false;
  _hasIcon = false;
  _hasLabel = false;
  _icon;
  _iconSlot;
  _items;
  _itemsSlot;
  _labelSlot;
  _lockedType = false;
  _menu;
  _mql;
  _mqlHandler;
  _originalType;
  _summary;

  // -- Static --

  static _menus = new Map();

  static observedAttributes = [
    'breakpoint',
    'debug',
    'group',
    'open',
    'justify',
    'swipe-threshold',
    'top',
    'type'
  ];

  static template = document.createElement('template');
  static {
    this.template.innerHTML = `
      <details part="menu" id="menu">
        <summary part="label" id="summary" role="button" aria-expanded="false">
          <span part="icon" id="icon">
            <slot name="icon"></slot>
          </span>
          <span id="label">
            <slot name="label"></slot>
          </span>
        </summary>
        <div part="items" id="items">
          <slot></slot>
        </div>
      </details>
    `;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(AMenu.template.content.cloneNode(true));
    this.shadowRoot.adoptedStyleSheets = [styles];
    this._menu = this.shadowRoot.getElementById('menu');
    this._icon = this.shadowRoot.getElementById('icon');
    this._iconSlot = this.shadowRoot.querySelector('slot[name="icon"]');
    this._items = this.shadowRoot.getElementById('items');
    this._itemsSlot = this.shadowRoot.querySelector('slot:not([name])');
    this._labelSlot = this.shadowRoot.querySelector('slot[name="label"]');
    this._summary = this.shadowRoot.querySelector('summary');
  }

  // -- Lifecycle --

  attributeChangedCallback(attr, oldval, newval) {
    if (oldval === newval) return;
    switch (attr) {
    case 'breakpoint':
      this._setupMediaQuery(newval);
      break;
    case 'debug':
      this._debug = this.hasAttribute('debug');
      break;
    case 'group':
      this._group = newval;
      if (oldval) AMenu._menus.get(oldval)?.delete(this);
      if (newval) AMenu.register(newval, this);
      if (window.abind) abind.update(this, 'group', newval);
      break;
    case 'open':
      this._open = this.hasAttribute('open');
      if (this._connected) this._toggleMenu();
      if (window.abind) abind.update(this, 'open', newval);
      break;
    case 'top':
      this._top = this.hasAttribute('top');
      if (window.abind) abind.update(this, 'top', this._top);
      break;
    case 'type':
      this._type = newval;
      if (!this._connected) return;
      if (this._lockedType) return;
      this._applyType(newval);
      if (window.abind) abind.update(this, 'type', newval);
      break;
    }
  }

  connectedCallback() {
    this._connected = true;
    if (this.id) this._menu.dataset.parent = this.id;
    this._abortController = new AbortController();
    if (this.parentElement?.closest('a-menu') === null) {
      this.top = true;
    }

    if (this.parentElement?.closest('a-menu') !== null && this.hasAttribute('type') ) {
      this._lockedType = true;
    }

    this._applyType(this._type);
    this._addListeners();
    this._setupMediaQuery(this.breakpoint);
    if (this._open) this._toggleMenu();
  }

  disconnectedCallback() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    if (this._group) {
      const groupSet = AMenu._menus.get(this._group);
      if (groupSet) groupSet.delete(this);
    }

    if (this._mql && this._mqlHandler) {
      this._mqlHandler.removeEventListener('change', this._mqlHandler);
    }
  }

  // -- Private --

  _addListeners() {
    this._menu.addEventListener('click', (event) => {
      const path = event.composedPath();
      if (path.includes(this._summary)) {
        event.preventDefault();
        event.stopPropagation();
        if (event.target.tabIndex < 0) {
          this.open = !this.open;
        }
      }
    }, { signal:this._abortController.signal });

    this._labelSlot.addEventListener('slotchange', () => {
      this._hasLabel = this._labelSlot.assignedElements().length > 0;
      this._hasIcon = this._iconSlot.assignedElements().length > 0;
      this._maybeHideHeader();
      this._maybeShowIcon();
    }, { signal: this._abortController.signal });
  }

  _applyType(value) {
    if (this._lockedType) return;

    const types = ['mobile', 'classic', 'ribbon', 'dropdown', 'flyout', 'sitemap'];
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

    this._maybeHideHeader();
    this._applyTypeToNested(value);
  }

  async _applyTypeToNested(value) {
    clearTimeout(this._applyNestedTimeout);

    this._applyNestedTimeout = setTimeout(async () => {
      if (!this.isConnected) return;

      const nested = Array.from(this.children).filter(item => item.localName === 'a-menu');
      if (!nested.length) return;

      await customElements.whenDefined('a-menu');

      for (const child of nested) {
        let type = value;
        if (this._type === 'classic') type = 'dropdown';
        if (this._type === 'dropdown') type = 'flyout';

        if (child.type !== type) {
          child.type = type;
        }
      }
    }, 100);
  }

  _closeOthers(elem, group) {
    const set = AMenu._menus.get(group);
    if (!set) return console.warn(`the group "${group}" was not registered.`);
    for (const menu of set) {
      if (menu === elem) continue;
      if (menu.open) menu.open = false;
    }
  }

  _closeWithTransition(menu, items) {
    menu.classList.remove('open');

    const duration = parseFloat(getComputedStyle(items).transitionDuration) * 1000 || 0;
    const fallbackDelay = duration > 0 ? duration + 50 : 50;
    let isClosed = false;

    const closeMenu = (event) => {
      if (event && event.target !== items) return;
      if (isClosed) return;

      isClosed = true;
      menu.open = false;
      items.removeEventListener('transitionend', closeMenu);
      clearTimeout(fallbackTimeout);
    };

    items.addEventListener('transitionend', closeMenu);
    const fallbackTimeout = setTimeout(closeMenu, fallbackDelay);
  }

  _maybeHideHeader() {
    this._summary.hidden = !this._hasLabel && !this._maybeShowIcon();
    if (!this._hasLabel) this.open = true;
  }

  _maybeShowIcon() {
    const show = this._hasIcon && this._showIcon.includes(this.type);
    if (show) {
      this._icon.classList.remove('hidden');
    } else {
      this._icon.classList.add('hidden');
    }

    return show;
  }

  _setupMediaQuery(maxWidth) {
    if (this._mql && this._mqlHandler) {
      this._mql.removeEventListener('change', this._mqlHandler);
    }

    if (!maxWidth) return;
    this._mql = window.matchMedia(`max-width: ${maxWidth}px`);

    this._mqlHandler = (event) => {
      if (event.matches) {
        if (this.type !== 'mobile') {
          this._originalType = this.type;
          this.type = 'mobile';
        }
      } else {
        // screen is larger
        if (this._originalType && this.type === 'mobile') {
          this.type = this._originalType;
          this._originalType = null;
        }
      }
    };

    this._mql.addEventListener('change', this._mqlHandler);
    this._mqlHandler(this._mql);
  }

  _toggleMenu() {
    if (this.debug) console.log(this._open, this._menu.open);
    if (this._open && !this._menu.open) {
      this._menu.open = true;
      this._menu.classList.add('open');
      if (this._group) this._closeOthers(this, this._group);
    } else if (!this.open && this._menu.open) {
      this._closeWithTransition(this._menu, this._items);
    }
  }

  // -- Public --

  static register(group, elem) {
    if (!this._menus.has(group)) this._menus.set(group, new Set());
    this._menus.get(group).add(elem);
  }

  // -- Getters / Setters --

  get breakpoint() { return this.getAttribute('breakpoint') }
  set breakpoint(value) {
    if (value) {
      this.setAttribute('breakpoint', value);
    } else {
      this.removeAttribute('breakpoint');
    }
  }

  get debug() { return this._debug }
  set debug(value) {
    const isOpen = value !== null && value !== false && value !== "false";
    this.toggleAttribute('debug', isOpen);
  }

  get group() { return this._group }
  set group(value) { this.setAttribute('group', value) }

  get open() { return this._open }
  set open(value) {
    const isOpen = value !== null && value !== false && value !== "false";
    this.toggleAttribute('open', isOpen);
  }

  get top() { return this._top }
  set top(value) {
    const isTop = value !== null && value !== false && value !== "false";
    this.toggleAttribute('top', isTop);
  }

  get type() { return this._type }
  set type(value) { this.setAttribute('type', value) }
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
