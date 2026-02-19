export default class AMenu extends HTMLElement {
  // -- Attributes --
  _group;
  _open = false;
  _type = 'mobile';

  // -- Private --

  _abortController;
  _header;
  _headerSlot;
  _menu;
  _staticType = false;
  _swipeStart = 0;
  _swipeEnd = 0;
  _swipeThreshold = 40;

  // -- connection --
  _connected = false;
  #resolveConnected;
  #connectedPromise = new Promise(resolve => {
    this.#resolveConnected = resolve;
  });

  // -- Static --

  static _menus = new Map();

  static observedAttributes = [
    'group',
    'open',
    'type'
  ];

  static template = document.createElement('template');
  static {
    this.template.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          interpolate-size: allow-keywords;
        }

        details {
          background: inherit;
          display: flex;
          position: relative;
          width: 100%;
        }

        details::details-content {
          display: block;
          overflow: hidden;
          height: 0;
          transition: height 0.25s ease, content-visibility 0.4s allow-discrete;
        }

        details[open]::details-content
        { height: auto; }

        #items {
          background: inherit;
          display: flex;
          flex: 1;
          flex-wrap: wrap;
          position: absolute;
          z-index: 2;
        }

        /* --- Mobile --- */
        details.mobile {
          flex-direction: column;
        }

        details.mobile #items {
          position: relative;
          flex-direction: column;
          left: 0;
          width: 100%;
        }

        /* --- Classic --- */
        details.classic {

        }

        details.classic #items {
          flex-direction: row;
        }

        /* --- Ribbon --- */
        details.ribbon {
          position: static;
          flex-direction: column;
        }

        details.ribbon #items {
          flex-direction: row;
          left: 0;
          width: 100vw;
          position: absolute;
        }

        /* --- Dropdown --- */
        details.dropdown {
          flex-direction: column;
          width: max-content;
        }

        details.dropdown #items {
          top: 100%;
          left: 0;
          flex-direction: column;
          min-width: 100%;
          width: max-content;
        }

        /* --- Flyout --- */
        details.flyout {
          flex-direction: column;
          width: max-content;
        }

        details.flyout #items {
          left: 100%;
          top: 0;
          flex-direction: column;
          min-width: 200px;
          width: max-content;
        }
      </style>

      <details part="menu" id="menu" class="mobile">
        <summary part="header" id="header">
          <span part="label" id="label">
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
  }

  // -- Lifecycle --

  attributeChangedCallback(attr, oldval, newval) {
    if (oldval === newval) return;
    switch (attr) {
      case 'group':
        this._group = newval;
        if (this._connected) {
          this._menu.setAttribute('group', newval);
          if (window.abind) abind.update(this, 'group', newval);
        }
        break;

      case 'open':
        this._open = this.hasAttribute('open');
        if (this._connected) {
          this._menu.open = this._open;
          if (window.abind) abind.update(this, 'open', this._open);
        }
        break;

      case 'swipe-threshold':
        this._swipeThreshold = Number(newval);
        if (this._connected) {
          if (window.abind) abind.update(this, 'swipeThreshold', this._swipeThreshold);
        }
        break;

      case "type":
        this._type = newval;
        if (this._connected && !this._staticType) {
          this.applyType(newval);
          if (window.abind) abind.update(this, 'type', newval);
        }
        break;
    }
  }

  connectedCallback() {
    this._abortController = new AbortController;
    this.shadowRoot.append(AMenu.template.content.cloneNode(true));
    this._menu = this.shadowRoot.querySelector('#menu');
    this._header = this.shadowRoot.querySelector('#header');
    this._headerSlot = this.shadowRoot.querySelector('slot[name="label"]');
    this._connected = true;
    if (
      this.parentElement.closest('a-menu') !== null &&
      this.hasAttribute('type')
    ) {
      this._staticType = true;
    }

    this.applyType(this._type);
    this.maybeHideHeader();
    this._menu.open = this._open;
    this.addListeners();
  }

  disconnectedCallback() {
    this._connected = false;
  }

  // -- Private --

  addListeners() {
    if (this._group) {
      AMenu.register(this._group, this._menu);
      this._menu.addEventListener("toggle", () => {
        if (this._menu.open) AMenu.openGroup(this._group, this._menu);
      }, { signal: this._abortController.signal });
    }

    let startY = 0;
    let endY = 0;

    this.addEventListener('touchstart', event => {
      this._swipeStart = event.touches[0].clientY;
    }, { signal: this._abortController.signal });

    this.addEventListener('touchend', event => {
      this._swipeEnd = event.changedTouches[0].clientY;
      this.handleSwipe();
    }, { signal: this._abortController.signal });
  }

  applyType(value) {
    const types = ['mobile', 'classic', 'ribbon', 'dropdown', 'flyout'];
    this._menu.classList.remove(...types);
    this._menu.classList.add(value);
    this.applyTypeToNested(value);
  }

  async applyTypeToNested(value) {
    // wait for nested a-menu's to connect
    await this.whenConnected();
    const nested = Array.from(this.children).filter( item => item.localName === 'a-menu');

    for (const child of nested) {
      switch (this._type) {
      case 'classic':
        child.type = 'dropdown';
        break;
      case 'dropdown':
        child.type = 'flyout';
        break;
      default:
        child.type = value;
      }
    }
  }

  handleSwipe() {
    const delta = this._swipeEnd - this._swipeStart;
    if (Math.abs(delta) < this._swipeThreshold) return;
    this.toggleAttribute('open', delta > 0);
  }

  maybeHideHeader() {
    const hasLabel = this._headerSlot.assignedNodes().length > 0;

    if (!hasLabel) {
      this.open = true;
      this._header.hidden = true;
    }
  }

  // --- Public --

  async whenConnected() {
    if (this._connected) return true;
    await this.#connectedPromise;
    return true;
  }

  static openGroup(group, elem) {
    this._menus.get(group)?.forEach( other => {
      if (other !== elem) other.open = false;
    });
  }

  static register(group, elem) {
    if (!this._menus.has(group)) this._menus.set(group, new Set());
    this._menus.get(group).add(elem);
  }

  // -- Getters / Setters --

  get group() { return this._group }
  set group(value) { this.setAttribute('group', value) }

  get open() { return this._open }
  set open(value) {
    this.toggleAttribute('open', value !== undefined && value !== false);
  }

  get swipeThreshold() { return this._swipeThreshold }
  set swipeThreshold(value) { this.setAttribute('swipe-threshold', value)}

  get type() { return this._type }
  set type(value) {
    if (this._staticType) return;
    this.setAttribute('type', value)
  }
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
