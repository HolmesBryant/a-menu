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
	#labelSlot;
	#menu;
	#label;
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
					--min: 35px;

					display: block;
					interpolate-size: allow-keywords;
				}

				menu {
					display: flex;
					flex-direction: column;
					list-style: none;
					margin: 0;
					padding: 0;
					position: relative;
					flex: 1;

					& li {
						display: flex;
						flex-direction: column;
						height: min-content;
						align-items: baseline;
						min-width: max-content;
					}

					& #items {
						height: 0;
						top: 100%;
						overflow: clip;
						transition: all .25s allow-discrete;
						min-width: 200px;
						width: 100%;
						z-index: 1;
					}

					&[open] #items {
						height: auto;
						overflow: visible;
					}
				}

				::slotted(*),
				#label {
					align-items: center;
					display: flex;
					min-height: var(--min);
					width: 100%;
					padding: 0 .5rem;
				}

				#items {
					white-space: nowrap
				}

				menu.classic {
					display: inline-flex;
					flex-direction: row;

					& li {
						display: inline-flex;
						flex-direction: row;
						gap: 1rem;
						position: absolute;
					}
				}

				menu.flydown {
					flex-direction: column;
					position: relative;

					& #items {
						height: 0;
						position: absolute;
						top: 100%;
						overflow: clip;
						transition: all .25s allow-discrete;
						min-width: 200px;
						width: 100%;
						z-index: 1;
					}

					&[open] #items {
						height: auto;
						overflow: visible;
					}
				}

				menu.flyout {
					flex-direction: row;
					position: relative;

					& #items {
						min-width: 0;
						width: 0;
						position: absolute;
						left: 100%;
						overflow: clip;
						transition: all .25s allow-discrete;
						z-index: 1;
					}

					&:hover #items {
						width: auto;
						min-width: 200px;
						overflow: visible;
					}
				}
			</style>

			<menu part="menu">
				<li part="label" id="label" tabindex="0">
					<slot name="label"></slot>
				</li>
				<li part="items" id="items"><slot tabindex="0"></slot></li>
			</menu>
		`;
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.#abortController = new AbortController();
		this.shadowRoot.append(AMenu.template.content.cloneNode(true));
		this.#menu = this.shadowRoot.querySelector('menu');
		this.#label = this.shadowRoot.querySelector('#label');
		this.#labelSlot = this.shadowRoot.querySelector('slot[name="label"]');
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
		this.#label.addEventListener('click', () => {

			if (this.#group) {
				AMenu.openMenu(this.#group, this)
			} else {
				this.toggleAttribute('open', !this.#open);
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
		const hasLabel = this.#labelSlot.assignedNodes().length > 0;

		if (this.top && !hasLabel) this.open = true;
		if (this.#group) AMenu.register(this.#group, this.#menu);

	  if (parent instanceof AMenu) {
	  	await parent.whenConnected();
	  }

	  const mobile = this.closest('a-menu[type="mobile"]');
	  const classic = this.closest('a-menu[type="classic"]');
	  const labels = this.#labelSlot.assignedNodes();

		if (classic && !this.hasAttribute('type')) {
			if (parent.top === true) {
				this.type = 'flydown';
			} else if (parent instanceof AMenu) {
				this.type = 'flyout';
			}
		}

		this.#addListeners();

		if (!this.#connected) {
	    this.#connected = true;
	    this.#resolveConnected();
	  }
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
