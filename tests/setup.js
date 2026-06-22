/**
 * Test environment setup, run before every test file.
 *
 * jsdom does not implement a layout engine, so several browser APIs are missing
 * or incomplete. The shims below are guarded so they only apply when running in
 * a jsdom environment (where `document` is defined).
 */

if (typeof document !== 'undefined') {
	// document.scrollingElement is undefined in jsdom; use documentElement as the fallback.
	Object.defineProperty(document, 'scrollingElement', {
		get: () => document.documentElement,
		configurable: true,
	});

	// document.elementFromPoint / elementsFromPoint are not implemented in jsdom.
	// Provide no-op defaults; individual tests override them as needed.
	document.elementFromPoint = () => null;
	document.elementsFromPoint = () => [];

	// caretPositionFromPoint / caretRangeFromPoint are not implemented in jsdom.
	document.caretPositionFromPoint = () => null;

	// jsdom's PointerEvent rejects `view: window` with a strict WebIDL type check that
	// does not recognize the jsdom window as a valid Window. Replace it with a shim that
	// preserves the important PointerEvent properties while omitting the `view` member.
	globalThis.PointerEvent = class PointerEvent extends Event {
		constructor(type, init = {}) {
			const initWithoutView = { ...init };
			delete initWithoutView.view;
			super(type, initWithoutView);
			this.pointerId = init.pointerId ?? 0;
			this.pointerType = init.pointerType ?? '';
			this.isPrimary = init.isPrimary ?? false;
			this.clientX = init.clientX ?? 0;
			this.clientY = init.clientY ?? 0;
			this.button = init.button ?? 0;
			this.buttons = init.buttons ?? 0;
			this.offsetX = 0;
			this.offsetY = 0;
		}
	};
}

