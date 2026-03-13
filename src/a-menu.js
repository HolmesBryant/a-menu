import styles from './a-menu-shadow.css' with {type: 'css'};

export default class AMenu extends HTMLElement {
  // -- Attributes --
  _group;
  _showIcon = ['mobile', 'flyout', 'dropdown'];
  _open = false;
  _justify = "center";
  _type = 'classic';

  // -- Private --

  _top = false;
  _abortController;
  _hasIcon = false;
  _hasLabel = true;
  _header;
  _headerSlot;
  _iconSlot;
  _menu;
  _itemsSlot;
  _lockedType = false;
  _swipeStart = 0;
  _swipeEnd = 0;
  _swipeThreshold = 40;
  _typeStyles;

  // -- connection --
  _connected = false;
  #resolveConnected;
  #connectedPromise = new Promise(resolve => {
    this.#resolveConnected = resolve;
  });

  // -- nested updates
  _rafDelay = 100;
  _rafHandle = null;
  _timeStart = null;
  _token = null;

  // -- Static --

  static _menus = new Map();

  static observedAttributes = [
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
        <summary part="header" id="header" role="button" aria-expanded="false">
          <span part="icon" id="icon">
            <slot name="icon"></slot>
          </span>
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
    this.shadowRoot.append(AMenu.template.content.cloneNode(true));
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(':host { --type: var(--inherited-type, flyout) }');
    this.shadowRoot.adoptedStyleSheets = [styles, sheet];
    this._typeStyles = sheet;
    this._menu = this.shadowRoot.getElementById('menu');
    this._icon = this.shadowRoot.getElementById('icon');
    this._header = this.shadowRoot.getElementById('header');
    this._itemsSlot = this.shadowRoot.querySelector('slot:not([name])');
    this._headerSlot = this.shadowRoot.querySelector('slot[name="label"]');
    this._iconSlot = this.shadowRoot.querySelector('slot[name="icon"]');
  }

  // -- Lifecycle --

  attributeChangedCallback(attr, oldval, newval) {
    if (oldval === newval) return;
    switch (attr) {
      case 'group':
        if (this._connected && oldval) AMenu._menus.get(oldval)?.delete(this._menu);
        this._group = newval;
        if (this._connected) {
          if (newval) {
            this._menu.setAttribute('group', newval);
            AMenu.register(newval, this._menu);
          } else {
            this._menu.removeAttribute('group');
          }
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

      case 'justify':
        this._justify = newval;
        this.setJustify(newval);
        if (window.abind) abind.update(this, 'justify', this._justify);
        break;

      case 'swipe-threshold':
        this._swipeThreshold = Number(newval);
        if (this._connected) {
          if (window.abind) abind.update(this, 'swipeThreshold', this._swipeThreshold);
        }
        break;

      case 'top':
        this._top = this.hasAttribute('top');
        if (window.abind) abind.update(this, 'top', this._top);
        break;
      case "type":
        this._type = newval;
        if (this._connected && !this._lockedType) {
          this.applyType(newval);
          if (window.abind) abind.update(this, 'type', newval);
        }
        break;
    }
  }

  connectedCallback() {
    this._abortController = new AbortController;
    this._connected = true;
    this._hasLabel = this._headerSlot.assignedElements().length > 0;
    this._hasIcon = this._iconSlot.assignedElements().length > 0;
    this.#resolveConnected();

    if (this.parentElement?.closest('a-menu') === null) {
      this.top = true;
    }

    if (
      this.parentElement?.closest('a-menu') !== null &&
      this.hasAttribute('type')
    ) {
      this._lockedType = true;
    }

    if (this._hasIcon) this._header.style.listStyle = 'none';
    this.applyType(this._type);
    this.maybeHideHeader();
    if (this._group) AMenu.register(this._group, this._menu);
    this._menu.open = this._open;
    // this._mediaQueries = this.getMediaQueries(this, '--type');
    this.addListeners();
  }

  disconnectedCallback() {
    this._connected = false;

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }

    if (this._timeStart) this._timeStart = null;
    this._token = null;

    if (this._group) {
      AMenu._menus.get(this._group)?.delete(this._menu);
    }

    this._menu = null;
    this._header = null;
    this._headerSlot = null;
  }

  // -- Private --

  addListeners() {
    this._menu.addEventListener("toggle", () => {
      if (this._menu.open) AMenu.openGroup(this._group, this._menu);
      // use setter
      this.open = this._menu.open;
      this._header.setAttribute('aria-expanded', String(this._menu.open));
    }, { signal: this._abortController.signal });

    this.addEventListener('touchstart', event => {
      this._swipeStart = event.touches[0].clientY;
    }, {
      signal: this._abortController.signal,
      passive: true
    });

    this.addEventListener('touchend', event => {
      this._swipeEnd = event.changedTouches[0].clientY;
      this.handleSwipe();
    }, { signal: this._abortController.signal });

    this._headerSlot.addEventListener('slotchange', () => {
      this._hasLabel = this._headerSlot.assignedElements().length > 0;
      this._hasIcon = this._iconSlot.assignedElements().length > 0;
      this.maybeHideHeader();
      this.maybeShowIcon();
    }, { signal: this._abortController.signal });

    this.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      this._swipeStart = e.clientY;
    }, { signal: this._abortController.signal });

    this.addEventListener('pointerup', e => {
      if (e.pointerType === 'touch') return;
      this._swipeEnd = e.clientY;
      this.handleSwipe();
    }, { signal: this._abortController.signal });
  }

  applyType(value) {
    const types = ['mobile', 'classic', 'ribbon', 'dropdown', 'flyout', 'sitemap'];
    for (const type of types) {
      if (!this._lockedType && type !== value) this.removeAttribute(type);
    }

    // Guard: Only set attribute if different to prevent infinite recursion
    if (!this._lockedType && this.getAttribute('type') !== value) {
      this.setAttribute('type', value);
      return; // Stop here, attributeChangedCallback will call applyType again
    }

    this.maybeHideHeader();
    this.maybeShowIcon();
    this.setTypeStyle(value);
    this.applyTypeToNested(value);
  }

  async applyTypeToNested(value) {
    const invocationToken = Symbol('applyTypeToNested');
    this._token = invocationToken;

    // Cancel any in-progress rAF debounce
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    if (this._timeStart) {
      this._timeStart = null;
    }

    const delay = Number(this._applyTypeToNestedDelay ?? 100); // ms
    const start = performance.now();
    this._timeStart = start;

    return new Promise((resolve) => {
      const tick = async (now) => {
        // prevent race condition from overlapping calls
        if (this._token !== invocationToken) {
          this._rafHandle = null;
          this._timeStart = null;
          return resolve(false);
        }

        if (!this.isConnected) {
          this._rafHandle = null;
          this._timeStart = null;
          return resolve(false);
        }

        // if another call started later, abort
        if (this._timeStart !== start) {
          return resolve(false);
        }

        if (now - start >= delay) {
          this._rafHandle = null;
          this._timeStart = null;

          try {
            // prevent stale updates after disconnection or new call
            if (this._token !== invocationToken) {
              return resolve(false);
            }

            await this.whenConnected();

            if (this._token !== invocationToken || !this.isConnected) {
              return resolve(false);
            }

            await customElements.whenDefined('a-menu');

            if (this._token !== invocationToken || !this.isConnected) {
              return resolve(false);
            }

            const nested = Array.from(this.children).filter(
              item => item.localName === 'a-menu'
            );

            for (const child of nested) {
              if (this._token !== invocationToken || !this.isConnected) {
                return resolve(false);
              }

              if (typeof child.whenConnected === 'function') {
                await child.whenConnected();
              }

              if (this._token !== invocationToken) {
                return resolve(false);
              }

              let type;
              switch (this._type) {
                case 'classic':
                  type = 'dropdown';
                  break;
                case 'dropdown':
                  type = 'flyout';
                  break;
                default:
                  type = value;
              }

              // Only update if this is still the latest invocation
              if (child.type !== type && this._token === invocationToken) {
                child.type = type;
              }
            }

            resolve(true);
          } catch (e) {
            console.warn('Error in applyTypeToNested:', e);
            resolve(false);
          }
        } else {
          // prevent orphaned rAF callbacks from stale invocations
          if (
            this._token === invocationToken &&
            this.isConnected
          ) {
            this._rafHandle = requestAnimationFrame(tick);
          } else {
            this._rafHandle = null;
            resolve(false);
          }
        }
      };

      // Schedule initial tick
      if (this.isConnected && this._token === invocationToken) {
        this._rafHandle = requestAnimationFrame(tick);
      } else {
        resolve(false);
      }
    });
  }

  doMediaQuery(query) {
    console.log(query);
    // const mql = matchMedia("(max-width: 600px)");

    /*mql.addEventListener("change", e => {
      if (e.matches) {
        console.log("Now ≤ 600px");
      } else {
        console.log("Now > 600px");
      }
    });*/
  }

  handleSwipe() {
    const delta = this._swipeEnd - this._swipeStart;
    if (Math.abs(delta) < this._swipeThreshold) return;
    this.toggleAttribute('open', delta > 0);
  }

  maybeHideHeader() {
    this._header.hidden = !this._hasLabel && !this.maybeShowIcon();
    if (!this._hasLabel) this.open = true;
  }

  maybeShowIcon() {
    const show = this._hasIcon && this._showIcon.includes(this.type);
    if (show) {
      this._icon.classList.remove('hidden');
    } else {
      this._icon.classList.add('hidden');
    }

    return show;
  }

  setJustify(value) {
    const assigned = this._itemsSlot.assignedElements();
    if (value === 'stretch') {
      this.style.removeProperty('--justify');
      for (const elem of assigned) {
        elem.style.setProperty('flex', 1);
      }
    } else {
      for (const elem of assigned) {
        elem.style.removeProperty('flex');
      }
      this.style.setProperty('--justify', value);

    }
  }

  setTypeStyle(value) {
    const sheet = this._typeStyles;
    const css = (this._top) ?
      `:host([top]) { --type: ${value} }` :
      `:host { --type: ${value} }`;

    sheet.replaceSync(css);
  }

  // --- Public --

  static openGroup(group, elem) {
    if (this._menus.size === 0) return;
    this._menus.get(group)?.forEach( other => {
      if (other !== elem) other.open = false;
    });
  }

  static register(group, elem) {
    if (!this._menus.has(group)) this._menus.set(group, new Set());
    this._menus.get(group).add(elem);
  }

  async whenConnected() {
    if (this._connected) return true;
    await this.#connectedPromise;
    return true;
  }

  // -- Getters / Setters --

  get group() { return this._group }
  set group(value) { this.setAttribute('group', value) }

  get open() { return this._open }
  set open(value) {
    this.toggleAttribute('open', value !== undefined && value !== false);
  }

  get justify() { return this._justify }
  set justify(value) { this.setAttribute('justify', value) }

  get swipeThreshold() { return this._swipeThreshold }
  set swipeThreshold(value) { this.setAttribute('swipe-threshold', value)}

  get top() { return this._top }
  set top(value) {
    this.toggleAttribute('top', value !== undefined && value !== false )
  }

  get type() { return this._type }
  set type(value) {
    if (this._lockedType) {
      return console.warn('Attempting to set type on element whose type is locked because it has a "type" attribute', this);
    }
    this.setAttribute('type', value)
  }
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
