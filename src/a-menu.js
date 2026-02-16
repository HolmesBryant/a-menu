export default class AMenu extends HTMLElement {

	// -- Attributes --
	#group;
	#open = false;
	#top = false;

	/**
	 * Number of pixels required to count as a swipe
	 */
	#swipeThreshold = 40;

	/**
	 * @private
	 * @type {String ['mobile', 'classic', 'ribbon', 'sitemap', 'flydown', 'flyout']}
	 */
	#type = 'mobile';

	// -- Private Properties --
	#abortController;
	#headerSlot;
	#menu;
	#header;
	#swipeStart = 0;
	#swipeEnd = 0;

	// -- connection --
	#connected = false;
	#resolveConnected;
	#connectedPromise = new Promise(resolve => {
	  this.#resolveConnected = resolve;
	});

	// -- Static --
	static observedAttributes = [
		// 'burger',
		'group',
		'min-width',
		'open',
		'swipe-threshold',
		'type',
		'top'
	];

	static #menus = new Map();

	static template = document.createElement('template');
	static {
		this.template.innerHTML = `
			<style>
				:host {
					display: block;
				}

				details {
          display: flex;
          position: relative;
        }

        #items {
          display: flex;
					position: absolute;
					z-index: 1;
					width: 100%;
        }

				details.mobile {
					flex-direction: column;
					position: static;

					& #items {
						flex-direction: column;
						left: 0;
						width: 100vw;
					}
				}

				details.classic {
					flex-direction: row;

					& #items {
						flex-direction: row;
					}
				}

				details.ribbon {
					position: static;
					flex-direction: column;

					& #items {
						flex-direction: row;
						left: 0;
						width: 100vw;
					}
				}

        details.flydown {
          flex-direction: column;

          & #items {
						flex-direction: column;
						z-index: 2;
          }
        }

				details.flyout {
          flex-direction: column;

          & #items {
						left: 100%;
						top: 0;
						flex-direction: column;
						z-index: 2;
          }
        }
			</style>

			<details part="menu" id="menu">
				<summary part="header" id="header">
					<span part="label" id="label">
						<slot name="label"></slot>
					</span>
				</summary>
				<div part="items" id="items">
					<slot></slot>
				</div>
			</menu>
		`;
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.#abortController = new AbortController();
		this.shadowRoot.append(AMenu.template.content.cloneNode(true));
		this.#menu = this.shadowRoot.querySelector('#menu');
		this.#header = this.shadowRoot.querySelector('#header');
		this.#headerSlot = this.shadowRoot.querySelector('slot[name="label"]');
	}

	// -- Lifecycle --

	async attributeChangedCallback(attr, oldval, newval) {
		if (newval === oldval) return;

		switch (attr) {
		case 'open':
			this.#open = this.hasAttribute('open');
			this.#menu.toggleAttribute('open', this.hasAttribute('open'));
			break;
		case 'group':
			this.#group = newval;
			this.#menu.setAttribute('group', newval);
			break;
		case 'top':
			this.#top = this.hasAttribute('top');
			this.#menu.toggleAttribute('top', this.#top);
			break;
		case 'type':
			this.#type = newval;
			this.#setType(newval);
			break;
		case 'swipe-threshold':
			this.#swipeThreshold = Number(newval);
		}
	}

	connectedCallback() {
		if (! (this.parentElement instanceof AMenu)) this.top = true;

		if (!this.hasAttribute('type') && this.top) {
			this.setAttribute('type', this.#type);
		}

		this.#init();
	}

	disconnectedCallback() {
		if (this.#abortController) {
			this.#abortController.abort();
			this.#abortController = null;
		}

		this.#connected = false;
	  this.#connectedPromise = new Promise(resolve => {
	    this.#resolveConnected = resolve;
	  });
	}

	// -- Private

	#addListeners() {
		this.#header.addEventListener('click', () => {
			if (this.#group) {
				AMenu.openMenu(this.#group, this)
			}
		}, { signal: this.#abortController.signal });

		let startY = 0;
		let endY = 0;

		this.addEventListener('touchstart', event => {
			this.#swipeStart = event.touches[0].clientY;
		}, { signal: this.#abortController.signal });

		this.addEventListener('touchend', event => {
			this.#swipeEnd = event.changedTouches[0].clientY;
			this.#handleSwipe();
		}, { signal: this.#abortController.signal });
	}

	#handleSwipe() {
		const delta = this.#swipeEnd - this.#swipeStart;
		if (Math.abs(delta) < this.#swipeThreshold) return;
		this.toggleAttribute('open', delta > 0);
	}

	async #init() {
		const parent = this.parentElement;
		const hasLabel = this.#headerSlot.assignedNodes().length > 0;

		if (!hasLabel) {
			this.open = true;
			this.#header.hidden = true;
		}

		if (this.top) {
			if (!this.hasAttribute('type')) this.type = this.#type;
		} else {
			if (!this.hasAttribute('type')) {
				const top = this.closest('a-menu[top]');
				this.type = top.type;
			}

		}

		// if (this.#group) AMenu.register(this.#group, this.#menu);


	}

	#setType(value) {
		const types = ['mobile', 'classic', 'ribbon', 'sitemap', 'flyout', 'flydown'];
		types.forEach( type => {
			this.#menu.classList.remove(type);
		});

		this.#menu.classList.add(value);
	}

	// -- Static Methods --

	static openMenu(group, elem) {
		this.#menus.get(group)?.forEach( other => {
			if (other !== elem) other.open = false;
		});
	}

	static register(group, elem) {
		if (!this.#menus.has(group)) this.#menus.set(group, new Set());
		this.#menus.get(group).add(elem);
	}


	// -- Public --

	async whenConnected() {
	  if (this.#connected) return true;
	  await this.#connectedPromise;
	  return true;
	}

	// -- Getters / Setters

	get menu() { return this.#menu }

	/*get burger() { return this.#burger }
	set burger(value) { this.toggleAttribute('burger', value !== false && value !== 'false') }*/

	// get group() { return this.#group }
	// set group(value) { this.setAttribute('group', value) }

	// get minWidth() { return this.#minWidth }
	// set minWidth(value) { this. setAttribute('min-width', value) }

	get open() { return this.#open }
	set open(value) { this.toggleAttribute('open', value !== false && value !== 'false')}

	get top() { return this.#top }
	set top(value) { this.toggleAttribute('top', value !== false && value !== undefined)}

	get type() { return this.#type }
	set type(value) { this.setAttribute('type', value) }

	// get swipeThreshold() { return this.#swipeThreshold }
	// set swipeThreshold(value) { this.setAttribute('swipe-threshold', Number(value))}
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
