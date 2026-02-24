const sheet = new CSSStyleSheet();sheet.replaceSync("/** * @file src/a-menu-shadow.css * CSS styles for a-menu custom element shadow dom */:host {  --bg-color: linen;  --duration: 0.5s;  --min-height: 35px;  --pad: 0.5rem;  interpolate-size: allow-keywords;  container-name: menu-system;  display: block;  box-sizing: border-box;  position: relative;  z-index: 1;  transition: z-index 0s linear var(--duration);}:host([top]) { --type: classic }:host([open]) {  z-index: 100;  transition-delay: 0s;}:host(:focus-within),:host(:hover) {  z-index: 1000;  transition-delay: 0s;}::slotted(a) {  display: flex;  align-items: center;  min-height: var(--min-height);  text-decoration: none;  white-space: nowrap;  padding: 0 var(--pad);  width: 100%;  box-sizing: border-box;}details {  box-sizing: border-box;  position: relative;  width: 100%;}details::details-content {  content-visibility: visible;  height: 0;  opacity: 0;  overflow: hidden;  transition:    height var(--duration) ease,    opacity var(--duration) ease,    content-visibility var(--duration) ease allow-discrete,    overflow 0s 0s;}details[open]::details-content {  height: auto;  opacity: 1;  overflow: visible;  /* Delay overflow:visible until AFTER animation so scrollbars don't flicker */  transition:    height var(--duration) ease,    opacity var(--duration) ease,    content-visibility var(--duration) ease allow-discrete,    overflow 0s var(--duration);}summary {  cursor: pointer;  padding: 0 var(--pad);  list-style: none;}#items {  /* Pass type down to children */  --inherited-type: var(--type);  display: flex;  flex-wrap: wrap;  align-items: stretch;  min-height: var(--min-height);}#label {  display: inline-flex;  align-items: center;  min-height: var(--min-height);  font-weight: bold;}/* --- Classic --- */@container menu-system style(--type: classic) {  details { display: block; width: 100%; }  ::slotted(a) { width: auto; }  #items {    --inherited-type: dropdown;    flex-direction: row;    width: 100%;  }}/* --- Mobile --- */@container menu-system style(--type: mobile) {  details {    display: flex;    flex-direction: column;    width: 100%;  }  #items {    flex-direction: column;    padding-left: var(--pad);    width: 100%;  }}/* --- Dropdown --- */@container menu-system style(--type: dropdown) {  details {    display: flex;    flex-direction: column;    width: max-content;  }  #items {    --inherited-type: flyout;    box-shadow: 0 4px 6px rgba(0,0,0,0.1); /* Optional shadow for depth */    flex-direction: column;    min-width: 100%;    position: absolute;    top: 100%; left: 0;    width: max-content;  }}/* --- Flyout --- */@container menu-system style(--type: flyout) {  details {    display: flex;    flex-direction: column;    width: max-content;  }  #items {    box-shadow: 4px 4px 6px rgba(0,0,0,0.1);    flex-direction: column;    position: absolute;    left: 100%; top: 0;    min-width: 200px;    width: max-content;  }}");
class AMenu extends HTMLElement {
  _group;
  _open = false;
  _type = 'classic';
  _abortController;
  _header;
  _headerSlot;
  _menu;
  _lockedType = false;
  _swipeStart = 0;
  _swipeEnd = 0;
  _swipeThreshold = 40;
  _typeStyle;
  _connected = false;
  #resolveConnected;
  #connectedPromise = new Promise(resolve => {
    this.#resolveConnected = resolve;
  });
  _rafHandle = null;
  _timeStart = null;
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
    const sheet$1 = new CSSStyleSheet();
    sheet$1.replaceSync(':host { --type: var(--inherited-type, flyout) }');
    this.shadowRoot.adoptedStyleSheets = [sheet$1, sheet];
    this._typeStyle = sheet$1;
    this._menu = this.shadowRoot.getElementById('menu');
    this._header = this.shadowRoot.getElementById('header');
    this._headerSlot = this.shadowRoot.querySelector('slot[name="label"]');
  }
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
    if (this.parentElement?.closest('a-menu') === null) {this.top = true; }
    if (this.parentElement?.closest('a-menu') !== null && this.hasAttribute('type') ) {this._lockedType = true; }
    this.applyType(this._type);
    this.maybeHideHeader();
    if (this._group) AMenu.register(this._group, this._menu);
    this._menu.open = this._open;
    this.addListeners();
  }
  disconnectedCallback() {
    this._connected = false;
    if (this._abortController) {this._abortController.abort(); this._abortController = null; }
    if (this._rafHandle) {cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    if (this._timeStart) {this._timeStart = null; }
    if (this._group) {AMenu._menus.get(this._group)?.delete(this._menu); }
    this._menu = null;
    this._header = null;
    this._headerSlot = null;
  }
  addListeners() {
    this._menu.addEventListener("toggle", () => {if (this._menu.open) AMenu.openGroup(this._group, this._menu); this.open = this._menu.open; this._header.setAttribute('aria-expanded', String(this._menu.open)); }, { signal: this._abortController.signal });
    this.addEventListener('touchstart', event => {this._swipeStart = event.touches[0].clientY; }, {signal: this._abortController.signal, passive: true });
    this.addEventListener('touchend', event => {this._swipeEnd = event.changedTouches[0].clientY; this.handleSwipe(); }, { signal: this._abortController.signal });
    this._headerSlot.addEventListener('slotchange', () => {this.maybeHideHeader(); }, { signal: this._abortController.signal });
    this.addEventListener('pointerdown', e => {if (e.pointerType === 'touch') return; this._swipeStart = e.clientY; }, { signal: this._abortController.signal });
    this.addEventListener('pointerup', e => {if (e.pointerType === 'touch') return; this._swipeEnd = e.clientY; this.handleSwipe(); }, { signal: this._abortController.signal });
  }
  applyType(value) {
    const types = ['mobile', 'classic', 'ribbon', 'dropdown', 'flyout'];
    for (const type of types) {if (!this._lockedType && type !== value) this.removeAttribute(type); }
    if (!this._lockedType && this.getAttribute('type') !== value) {this.setAttribute('type', value); return; }
    this.setStyle(value);
    this.applyTypeToNested(value);
  }
  async applyTypeToNested(value) {
    if (this._rafHandle) {cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    if (this._timeStart) {this._timeStart = null; }
    const delay = Number(this._applyTypeToNestedDelay ?? 100); // ms
    const start = performance.now();
    this._timeStart = start;
    return new Promise(resolve => {
      const tick = async (now) => {
        if (this._timeStart !== start) return resolve(false);
        if (now - start >= delay) {
          this._rafHandle = null;
          this._timeStart = null;
          await this.whenConnected();
          await customElements.whenDefined('a-menu');
          const nested = Array.from(this.children).filter(item => item.localName === 'a-menu');
          for (const child of nested) {
            if (typeof child.whenConnected === 'function') {await child.whenConnected(); }
            let type;
            switch (this._type) {case 'classic': type = 'dropdown'; break; case 'dropdown': type = 'flyout'; break; default: type = value; }
            if (child.type !== type) {child.type = type; }
          }
          resolve(true);
        } else {
          this._rafHandle = requestAnimationFrame(tick);
        }
      };
      this._rafHandle = requestAnimationFrame(tick);
    });
  }
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
  async whenConnected() {
    if (this._connected) return true;
    await this.#connectedPromise;
    return true;
  }
  static openGroup(group, elem) {
    if (this._menus.size === 0) return;
    this._menus.get(group)?.forEach( other => {if (other !== elem) other.open = false; });
  }
  static register(group, elem) {
    if (!this._menus.has(group)) this._menus.set(group, new Set());
    this._menus.get(group).add(elem);
  }
  get group() { return this._group }
  set group(value) { this.setAttribute('group', value); }
  get open() { return this._open }
  set open(value) {this.toggleAttribute('open', value !== undefined && value !== false); }
  get swipeThreshold() { return this._swipeThreshold }
  set swipeThreshold(value) { this.setAttribute('swipe-threshold', value);}
  get top() { return this._top }
  set top(value) {this.toggleAttribute('top', value !== undefined && value !== false ); }
  get type() { return this._type }
  set type(value) {if (this._lockedType) {return console.warn('Attempting to set type on element whose type is locked because it has a "type" attribute', this); } this.setAttribute('type', value); }
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
export { AMenu as default };
