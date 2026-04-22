/**
 * @file src/a-iframe.js
 * @author Holmes Bryant <https://github.com/HolmesBryant>
 * @license GPL-3.0
 * @version 1.1
 */

/**
 * A custom element that wraps a standard iframe element, providing automatic height resizing
 * based on the content's size and proxying standard iframe attributes.
 *
 * It utilizes a `ResizeObserver` to monitor the content height of the internal iframe
 * (requires same-origin or CORS) and supports injecting content via the slot.
 *
 * @extends {HTMLElement}
 * @element a-iframe
 */
export default class AIframe extends HTMLElement {
  #allow;
  #allowfullscreen;
  #credentialless;
  #csp;
  #importance;
  #loading;
  #name;
  #referrerpolicy;
  #sandbox;
  #src;
  #title;

  /**
   * Controller to handle cleanup of event listeners.
   * @private
   * @type {AbortController|null}
   */
  #abortController;

  /**
   * Reference to the internal <iframe> element in the Shadow DOM.
   * @private
   * @type {HTMLIFrameElement|null}
   */
  #iframe;

  /**
   * Observer for detecting size changes in the iframe content.
   * @private
   * @type {ResizeObserver|null}
   */
  #resizeObserver = null;

  /**
   * Reference to the <slot> element in the Shadow DOM.
   * @private
   * @type {HTMLSlotElement|null}
   */
  #slot;

  /**
   * List of attributes to observe for changes.
   * @readonly
   * @static
   * @type {string[]}
   */
  static observedAttributes = [
    'allow',
    'allowfullscreen',
    'credentialless',
    'csp',
    'importance',
    'loading',
    'name',
    'referrerpolicy',
    'sandbox',
    'src',
    'title'
  ];

  /**
   * The template element containing the Shadow DOM structure.
   * @static
   * @type {HTMLTemplateElement}
   */
  static template = document.createElement('template');
  static {
    this.template.innerHTML = `
      <style>
        :host {
          --transition-duration: .25s;

          display: block;
          height: auto;
          overflow: hidden;
        }

        iframe {
          border: 0;
          display: block;
          height: 100%;
          overflow: hidden;
          transition: height var(--transition-duration) ease-in-out;
          width: 100%;
        }
      </style>

      <iframe></iframe>
      <slot></slot>
    `;
  }

  /**
   * Creates an instance of AIframe and attaches the Shadow DOM.
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // -- Lifecycle --

  /**
   * Called when one of the observed attributes changes.
   * Updates internal state, the inner iframe attributes, and optionally triggers `abind.update`.
   *
   * @param {string} attr - The name of the attribute that changed.
   * @param {string|null} oldval - The previous value of the attribute.
   * @param {string|null} newval - The new value of the attribute.
   */
  attributeChangedCallback(attr, oldval, newval) {
    if (newval === oldval) return;

    switch (attr) {
      case 'allow':
        this.#allow = newval;
        break;
      case 'allowfullscreen':
        newval = this.hasAttribute(attr);
        this.#allowfullscreen = newval;
        break;
      case 'credentialless':
        newval = this.hasAttribute(attr);
        this.#credentialless = newval;
        break;
      case 'csp':
        this.#csp = newval;
        break;
      case 'importance':
        this.#importance = newval;
        break;
      case 'loading':
        this.#loading = newval;
        break;
      case 'name':
        this.#name = newval;
        break;
      case 'referrerpolicy':
        this.#referrerpolicy = newval;
        break;
      case 'sandbox':
        this.#sandbox = newval;
        break;
      case 'src':
        this.#src = newval;
        break;
      case 'title':
        this.#title = newval;
        break;
    }

    if (this.isConnected) this.#setIframeAttr(attr, newval);
    if (window.abind) abind.update(this, attr, newval);
  }

  /**
   * Called when the element is added to the DOM.
   * Initializes the Shadow DOM, event listeners, and the inner iframe.
   */
  connectedCallback() {
    this.#abortController = new AbortController();
    this.shadowRoot.append(AIframe.template.content.cloneNode(true));
    this.#iframe = this.shadowRoot.querySelector('iframe');
    this.#slot = this.shadowRoot.querySelector('slot');

    for (const attr of AIframe.observedAttributes) {
      if (this[attr] !== null && this[attr] !== undefined) {
        this.#setIframeAttr(attr, this[attr]);
      }
    }

    this.#iframe.addEventListener('load', () => {
      this.#init();
    }, { signal: this.#abortController.signal });

    this.#slot.addEventListener('slotchange', event => {
      this.#setSrcdoc(event);
    }, { signal: this.#abortController.signal });
  }

  /**
   * Called when the element is removed from the DOM.
   * Cleans up the ResizeObserver and AbortController.
   */
  disconnectedCallback() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }

  // -- Private --

  /**
   * Initializes the ResizeObserver on the iframe's content document.
   * Note: This requires the iframe content to be Same-Origin.
   * @private
   */
  #init() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }

    let doc;
    try {
      doc = this.#iframe.contentDocument;
    } catch {
      console.warn('Cross-origin content. Cannot resize', this);
      return;
    }

    if (!doc || !doc.body) return;

    this.#resizeObserver = new ResizeObserver(this.resize.bind(this));
    this.#resizeObserver.observe(doc.body);
  }

  /**
   * Sets an attribute on the internal iframe element.
   * @private
   * @param {string} attr - The attribute name.
   * @param {string|boolean|null} value - The attribute value.
   */
  #setIframeAttr(attr, value) {
    if (!this.#iframe) return;
    const booleanAttrs = ['allowfullscreen', 'credentialless'];
    if (booleanAttrs.includes(attr)) {
      this.#iframe.toggleAttribute(attr, this.hasAttribute(attr));
    } else {
      this.#iframe.setAttribute(attr, value ?? '');
    }
  }

  /**
   * Handles the `slotchange` event.
   * Extracts content from the slot (either from a textarea or raw HTML)
   * and sets it as the `srcdoc` of the internal iframe.
   * @private
   * @param {Event} event - The slotchange event.
   */
  #setSrcdoc(event) {
    const nodes = event.target.assignedNodes();
    if (!nodes.length) return;

    let htmlContent = '';
    const textarea = nodes.find(n => n.nodeName === 'TEXTAREA');

    if (textarea) {
        textarea.hidden = true;
        htmlContent = textarea.value || textarea.textContent;
    } else {
        htmlContent = nodes.map(n => n.nodeType === Node.ELEMENT_NODE ? n.outerHTML : n.textContent).join('');
    }

    if (!htmlContent.trim()) return;
    this.innerHTML = '';
    this.#iframe.srcdoc = htmlContent;
  }

  // -- Public --

  /**
   * Resizes the host element based on the provided dimensions.
   * This is typically used as the callback for the internal ResizeObserver,
   * but can be called manually.
   *
   * @param {ResizeObserverEntry[]|number|string} entries - The resize entries or a specific height value.
   */
  resize(entries) {
    if (!this.isConnected) return;
    if (!entries) return;
    let height;

    if (Array.isArray(entries)) {
      height = Math.ceil(entries[0].target.scrollHeight);
      if (height < 50) return;
    } else {
       height = parseFloat(entries);
    }

    if (!isNaN(height)) height++

    height += 20;
    this.style.height = `${height}px`;
  }

  // -- Getters / Setters

  get allow() { return this.#allow }
  set allow(value) { this.setAttribute('allow', value) }

  get allowfullscreen() { return this.#allowfullscreen }
  set allowfullscreen(value) { this.setAttribute('allowfullscreen', value) }

  get credentialless() { return this.#credentialless }
  set credentialless(value) { this.setAttribute('credentialless', value) }

  get csp() { return this.#csp }
  set csp(value) { this.setAttribute('csp', value) }

  get importance() { return this.#importance }
  set importance(value) { this.setAttribute('importance', value) }

  get loading() { return this.#loading }
  set loading(value) { this.setAttribute('loading', value) }

  get name() { return this.#name }
  set name(value) { this.setAttribute('name', value) }

  get referrerpolicy() { return this.#referrerpolicy }
  set referrerpolicy(value) { this.setAttribute('referrerpolicy', value) }

  get sandbox() { return this.#sandbox }
  set sandbox(value) { this.setAttribute('sandbox', value) }

  get src() { return this.#src }
  set src(value) { this.setAttribute('src', value) }

  get title() { return this.#title }
  set title(value) { this.setAttribute('title', value) }
}

if (!customElements.get('a-iframe')) customElements.define('a-iframe', AIframe);
