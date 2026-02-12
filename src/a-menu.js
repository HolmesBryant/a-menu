export default class AMenu extends HTMLElement {

	// -- Attributes --
	#group;
	// #minWidth;
	#open = false;
	#top = false;

	/**
	 * Number of pixels required to count as a swipe
	 */
	#swipeThreshold = 40;

	/**
	 * @private
	 * @type {String ['mobile', 'classic', 'ribbon', 'sitemap']}
	 */
	#type = "mobile";

	// -- Private Properties --
	#abortController;
	// #connected = false;
	#labelSlot;
	#menu;
	#label;
	#swipeStart = 0;
	#swipeEnd = 0;
	// static styleSheet;

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

				::slotted(*),
				#label {
					align-items: center;
					display: flex;
					min-height: var(--min);
					width: 100%;
					padding: 0 .5rem;
				}

				#items { white-space: nowrap }

				menu {
					display: flex;
					flex-direction: column;
					list-style: none;
					margin: 0;
					padding: 0;
					position: relative;

					& li {
						display: flex;
						flex-direction: column;
						height: min-content;
						align-items: baseline;
						min-width: max-content;
					}
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
						z-index: 1;
					}

					&[open] #items,
					&:hover #items {
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
				<li part="label" id="label"><slot name="label"></slot></li>
				<li part="items" id="items"><slot></slot></li>
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
			this.setType(newval);
			break;
		case 'swipe-threshold':
			this.#swipeThreshold = Number(newval);
		}
	}

	connectedCallback() {
		const labelNodes = this.#labelSlot.assignedNodes();
		if (!this.hasAttribute('type')) this.setAttribute('type', this.#type);
		if (! (this.parentElement instanceof AMenu)) {
			this.top = true;
		}

		if (this.parentElement instanceof AMenu && this.parentElement.top === true) {
			switch (this.parentElement.type) {
			case 'classic':
				this.type = 'flydown';
				break;
			}
		}


		if (labelNodes.length === 0) {
			this.toggleAttribute('open', true);
		}

		// this.#addListeners();
	}

	disconnectedCallback() {
		if (this.#abortController) {
			this.#abortController.abort();
			this.#abortController = null;
		}
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

	// -- Private

	#addListeners() {
		if (this.#group) {
			AMenu.register(this.#group, this.#menu);
			this.#menu.addEventListener("toggle", () => {
				if (this.#menu.open) AMenu.openMenu(this.#group, this.#menu);
			}, { signal: this.#abortController.signal });
		}

		this.#menu.addEventListener('toggle', () => {
			this.toggleAttribute('open', this.#menu.open);
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

	// -- Public --

	setType(value) {
		const types = ['mobile', 'classic', 'ribbon', 'sitemap', 'flyout'];
		types.forEach( type => {
			this.#menu.classList.remove(type);
			// this.classList.remove(type);
		});

		this.#menu.classList.add(value);
		// this.classList.add(value);
	}

	// -- Getters / Setters

	get menu() { return this.#menu }

	/*get burger() { return this.#burger }
	set burger(value) { this.toggleAttribute('burger', value !== false && value !== 'false') }*/

	// get group() { return this.#group }
	// set group(value) { this.setAttribute('group', value) }

	// get minWidth() { return this.#minWidth }
	// set minWidth(value) { this. setAttribute('min-width', value) }

	// get open() { return this.#open }
	// set open(value) { this.toggleAttribute('open', value !== false && value !== 'false')}

	get top() { return this.#top }
	set top(value) { this.toggleAttribute('top', value !== false && value !== undefined)}

	get type() { return this.#type }
	set type(value) { this.setAttribute('type', value) }

	// get swipeThreshold() { return this.#swipeThreshold }
	// set swipeThreshold(value) { this.setAttribute('swipe-threshold', Number(value))}
}

if (!customElements.get('a-menu')) customElements.define('a-menu', AMenu);
