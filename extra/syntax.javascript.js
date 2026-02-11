/**
 * Javascript syntax definition file for wijit-code web component
 *
 *  @author Holmes Bryant <https://github.com/HolmesBryant>
 *  @license GPL-3.0
 */
export default {
	argument: function(string, node) {
		const ranges = [];
		const regex = /\(\s*[\w]+(?:\s*,\s*([\w]+))*\s*\)/g
		const matches = string.matchAll(regex);

		for (const match of matches) {
			const idx = match.index;
			const items = match[0].split(',').map (item => item.replace(/[()]/g, '').trim());
			for (const item of items) {
				// avoid partial matches which indexOf would trip on
				const re = new RegExp('\\b' + item + '\\b');
				const start = idx + match[0].search(re);
				const range = new Range();
				range.setStart (node, start);
				range.setEnd (node, start + item.length);
				ranges.push(range);
			}
		}
		return ranges;
	},
	operator: /\+|-|(?<!(\/|\/\*{1,}|\n\s*))\*(?!\/)|(?<![\/\*])\/(?![\/\*])|%|===|!==|>=|<=|>|<|!=|=|&&|\|\||(?<!#)!/g,
	number: /[+.-]?\d+[\^\b\.\w]*/g,
	function: /(?<=\(|\b)\w+\s*\(|\(|\)/g,
	tag: /<\/?[\w-]+|(?<=[\w"])>/g,
	keyword: [
    // --- Control Flow & Reserved Words ---
    'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
    'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
    'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'of',
    'package', 'private', 'protected', 'public', 'return', 'set', 'static',
    'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined',
    'var', 'void', 'while', 'with', 'yield',

    // --- Core ECMA Global Objects & Types ---
    'AggregateError', 'Array', 'ArrayBuffer', 'AsyncFunction', 'Atomics',
    'BigInt', 'BigInt64Array', 'BigUint64Array', 'Boolean', 'DataView',
    'Date', 'Error', 'EvalError', 'FinalizationRegistry', 'Float32Array',
    'Float64Array', 'Function', 'Generator', 'GeneratorFunction', 'Infinity',
    'Int16Array', 'Int32Array', 'Int8Array', 'InternalError', 'Intl', 'JSON',
    'Map', 'Math', 'NaN', 'Number', 'Object', 'Promise', 'Proxy', 'RangeError',
    'ReferenceError', 'Reflect', 'RegExp', 'Set', 'SharedArrayBuffer', 'String',
    'Symbol', 'SyntaxError', 'TypeError', 'Uint16Array', 'Uint32Array',
    'Uint8Array', 'Uint8ClampedArray', 'URIError', 'WeakMap', 'WeakRef',
    'WeakSet', 'WebAssembly',

    // --- Common Web API Globals (Instances) ---
    'alert', 'caches', 'clearInterval', 'clearTimeout', 'console', 'crypto',
    'document', 'fetch', 'globalThis', 'history', 'indexedDB', 'localStorage',
    'location', 'matchMedia', 'module', 'navigator', 'performance', 'process',
    'prompt', 'queueMicrotask', 'requestAnimationFrame', 'require', 'screen',
    'sessionStorage', 'setInterval', 'setTimeout', 'window',

    // --- Common DOM Interfaces & Constructors ---
    'AbortController', 'AbortSignal', 'Audio', 'AudioTrack', 'AudioTrackList',
    'Blob', 'BroadcastChannel', 'ByteLengthQueuingStrategy', 'CanvasGradient',
    'CanvasPattern', 'CanvasRenderingContext2D', 'CharacterData', 'CloseWatcher',
    'Comment', 'CountQueuingStrategy', 'crypto', 'CustomElementRegistry',
    'CustomEvent', 'DataTransfer', 'DataTransferItem', 'DataTransferItemList',
    'Document', 'DOMException', 'DOMMatrix', 'DOMMatrixReadOnly', 'DOMParser',
    'DOMPoint', 'DOMPointReadOnly', 'DOMQuad', 'DOMRect', 'DOMRectReadOnly',
    'DOMStringList', 'DOMStringMap', 'DOMTokenList', 'DragEvent', 'Element',
    'ElementInternals', 'Event', 'EventSource', 'EventTarget', 'File', 'FileList',
    'FileReader', 'FormData', 'FormDataEvent', 'HashChangeEvent', 'Headers',
    'History', 'HTMLAllCollection', 'HTMLAnchorElement', 'HTMLAreaElement',
    'HTMLAudioElement', 'HTMLBaseElement', 'HTMLBodyElement', 'HTMLBRElement',
    'HTMLButtonElement', 'HTMLCanvasElement', 'HTMLCollection', 'HTMLDataElement',
    'HTMLDataListElement', 'HTMLDetailsElement', 'HTMLDialogElement',
    'HTMLDirectoryElement', 'HTMLDivElement', 'HTMLDListElement', 'HTMLElement',
    'HTMLEmbedElement', 'HTMLFieldSetElement', 'HTMLFontElement',
    'HTMLFormControlsCollection', 'HTMLFormElement', 'HTMLFrameElement',
    'HTMLFrameSetElement', 'HTMLHeadElement', 'HTMLHeadingElement', 'HTMLHRElement',
    'HTMLHtmlElement', 'HTMLIFrameElement', 'HTMLImageElement', 'HTMLInputElement',
    'HTMLLabelElement', 'HTMLLegendElement', 'HTMLLIElement', 'HTMLLinkElement',
    'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement',
    'HTMLMetaElement', 'HTMLMeterElement', 'HTMLModElement', 'HTMLObjectElement',
    'HTMLOListElement', 'HTMLOptGroupElement', 'HTMLOptionElement',
    'HTMLOptionsCollection', 'HTMLOutputElement', 'HTMLParagraphElement',
    'HTMLParamElement', 'HTMLPictureElement', 'HTMLPreElement', 'HTMLProgressElement',
    'HTMLQuoteElement', 'HTMLScriptElement', 'HTMLSelectElement', 'HTMLSlotElement',
    'HTMLSourceElement', 'HTMLSpanElement', 'HTMLStyleElement',
    'HTMLTableCaptionElement', 'HTMLTableCellElement', 'HTMLTableColElement',
    'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableSectionElement',
    'HTMLTemplateElement', 'HTMLTextAreaElement', 'HTMLTimeElement',
    'HTMLTitleElement', 'HTMLTrackElement', 'HTMLUListElement',
    'HTMLUnknownElement', 'HTMLVideoElement', 'Image', 'ImageBitmap',
    'ImageBitmapRenderingContext', 'ImageData', 'IntersectionObserver',
    'IntersectionObserverEntry', 'KeyboardEvent', 'Location', 'MediaError',
    'MessageChannel', 'MessageEvent', 'MessagePort', 'MimeType', 'MimeTypeArray',
    'MouseEvent', 'MutationObserver', 'MutationRecord', 'NamedNodeMap',
    'NavigateEvent', 'Navigation', 'NavigationActivation', 'NavigationCurrentEntryChangeEvent',
    'NavigationDestination', 'NavigationHistoryEntry', 'NavigationTransition',
    'Navigator', 'Node', 'NodeIterator', 'NodeList', 'OffscreenCanvas',
    'OffscreenCanvasRenderingContext2D', 'PageRevealEvent', 'PageTransitionEvent',
    'Path2D', 'Performance', 'PerformanceEntry', 'PerformanceMark', 'PerformanceMeasure',
    'PerformanceObserver', 'PerformanceObserverEntryList', 'PerformanceResourceTiming',
    'Plugin', 'PluginArray', 'PopStateEvent', 'PromiseRejectionEvent', 'RadioNodeList',
    'Range', 'ReadableStream', 'Request', 'ResizeObserver', 'ResizeObserverEntry',
    'Response', 'Screen', 'ShadowRoot', 'SharedWorker', 'SharedWorkerGlobalScope',
    'Storage', 'StorageEvent', 'SubmitEvent', 'SVGImageElement',
    'TextDecoder', 'TextEncoder', 'TextMetrics', 'TextTrack', 'TextTrackCue',
    'TextTrackCueList', 'TextTrackList', 'TimeRanges', 'ToggleEvent', 'Touch',
    'TouchEvent', 'TouchList', 'TrackEvent', 'TreeWalker', 'UIEvent', 'URL',
    'URLSearchParams', 'UserActivation', 'ValidityState', 'VideoTrack',
    'VideoTrackList', 'VisibilityStateEntry', 'WebSocket', 'Window', 'Worker',
    'WorkerGlobalScope', 'WorkerLocation', 'WorkerNavigator', 'Worklet',
    'WorkletGlobalScope', 'WritableStream', 'XMLHttpRequest', 'XMLSerializer'
	],
	string: /['"][^'"\n]*['"]|`[^`]*`/g,
	variable: /\$\s*{[^}]+}/g,
	comment: /\#\!.*|\/\/.*|\/\*(?!\*\/)[\s\S]+?\*\//gm,
}
