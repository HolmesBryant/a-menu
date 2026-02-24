import styles from './a-menu-shadow.css' with {type: 'css'};

export default class AMenu extends HTMLElement {
  // -- Attributes --
  _group;
  _open = false;
  _top = false;
  _type = 'classic';

  // -- Private --

  _abortController;
  _header;
  _headerSlot;
  _menu;
  _lockedType = false;
  _swipeStart = 0;
  _swipeEnd = 0;
  _swipeThreshold = 40;
  _typeStyle;

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
    'swipe-threshold',
    'top',
    'type'
  ];

  static template = document.createElement('template');
  static {
    this.template.innerHTML = `
      <details part="menu" id="menu">
        <summary part="header" id="header" role="button" aria-expanded="false">
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
    this.shadowRoot.adoptedStyleSheets = [sheet, styles];
    this._typeStyle = sheet;
    this._menu = this.shadowRoot.getElementById('menu');
    this._header = this.shadowRoot.getElementById('header');
    this._headerSlot = this.shadowRoot.querySelector('slot[name="label"]');
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

    this.applyType(this._type);
    this.maybeHideHeader();
    if (this._group) AMenu.register(this._group, this._menu);
    this._menu.open = this._open;
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
      this.maybeHideHeader()
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
    const types = ['mobile', 'classic', 'ribbon', 'dropdown', 'flyout'];
    for (const type of types) {
      if (!this._lockedType && type !== value) this.removeAttribute(type);
    }

    // Guard: Only set attribute if different to prevent infinite recursion
    if (!this._lockedType && this.getAttribute('type') !== value) {
      this.setAttribute('type', value);
      return; // Stop here, attributeChangedCallback will call applyType again
    }

    this.setStyle(value);
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

  /*async applyTypeToNested(value) {
    // Cancel in-progress debounces
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }

    if (this._timeStart) this._timeStart = null;

    const delay = Number(this._rafDelay ?? 100); // ms
    const start = performance.now();
    this._timeStart = start;

    return new Promise(resolve => {
      const tick = async (now) => {
        if (!this.isConnected) {
          this._rafHandle = null;
          this._timeStart = null;
          return resolve(false);
        }

        // If another call started later, abort
        if (this._timeStart !== start) return resolve(false);

        if (now - start >= delay) {
          this._rafHandle = null;
          this._timeStart = null;

          try {
            await this.whenConnected();
            await customElements.whenDefined('a-menu');
            const nested = Array.from(this.children).filter(item => item.localName === 'a-menu');

            for (const child of nested) {
              if (!this.isConnected) return resolve(false);
              if (typeof child.whenConnected === 'function') await child.whenConnected();

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

              if (child.type !== type) child.type = type;
            }

            resolve(true);
          } catch (error) {
            console.warn('Error in applyTypeToNested:', error);
            resolve(false);
          }
        } else {
          if (this.isConnected) {
            this._rafHandle = requestAnimationFrame(tick);
          } else {
            resolve(false);
          }
        }
      };

      this._rafHandle = requestAnimationFrame(tick);
    });
  }*/

  handleSwipe() {
    const delta = this._swipeEnd - this._swipeStart;
    if (Math.abs(delta) < this._swipeThreshold) return;
    this.toggleAttribute('open', delta > 0);
  }

  maybeHideHeader() {
    const hasLabel = this._headerSlot.assignedElements().length > 0;
    this._header.hidden = !hasLabel;
    if (!hasLabel) this.open = true;
  }

  setStyle(value) {
    const sheet = this._typeStyle;
    const css = `:host { --type: ${value} }`;
    sheet.replaceSync(css);
  }

  // --- Public --

  async whenConnected() {
    if (this._connected) return true;
    await this.#connectedPromise;
    return true;
  }

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

  // -- Getters / Setters --

  get group() { return this._group }
  set group(value) { this.setAttribute('group', value) }

  get open() { return this._open }
  set open(value) {
    this.toggleAttribute('open', value !== undefined && value !== false);
  }

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
