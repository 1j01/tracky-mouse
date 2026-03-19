/* global TrackyMouse */

TrackyMouse.dependenciesRoot = "./core";

await TrackyMouse.loadDependencies();

// Note: init currently extends the passed element,
// rather than replacing it or adding a child to it.
// That is technically the most flexible, I suppose,
// but may violate the principle of least surprise.
// I could accept an options object with mutually exclusive options
// to `extend`, `replace`, or `appendTo`.
TrackyMouse.init(document.getElementById("tracky-mouse-demo"));

// This example is based off of how JS Paint uses the Tracky Mouse API.
// It's simplified a bit, but includes various settings.
const config = {
	// The elements to click. Anything else is ignored.
	targets: `
		button:not([disabled]),
		input,
		textarea,
		label,
		a,
		details summary,
		.radio-or-checkbox-wrapper,
		.drawing-canvas,
		.window:not(.maximized) .window-titlebar
	`,
	// Filter for elements to drag. They must be included in the targets first.
	// shouldDrag: (target) => (
	// 	target.matches(".window-titlebar") ||
	// 	(target.matches(".drawing-canvas") && current_tool.supports_drag)
	// ),
	// Instead of clicking in the center of these elements, click at any point within the element.
	// This is useful for drag offsets, like for a window titlebar,
	// and position-based inputs like sliders or color pickers, or a drawing canvas.
	noCenter: (target) => (
		target.matches(`
			input[type="range"],
			.drawing-canvas,
			.window-titlebar
		`)
	),
	// Nudge hovers near the edges of an element onto the element itself,
	// to make it easier to click on the element.
	// More specifically it makes it easier to click on the edge of an element,
	// useful for a drawing canvas.
	retarget: [
		{ from: ".canvas-container", to: ".drawing-canvas", withinMargin: 50 },
	],
	// Elements that are equivalent are considered the same control.
	// This is useful for forms if you want the label of a radio button or checkbox
	// to be highlighted together with the radio button or checkbox.
	isEquivalentTarget: (apparent_hover_target, hover_target) => (
		apparent_hover_target.closest("label") === hover_target ||
		apparent_hover_target.closest(".radio-or-checkbox-wrapper") === hover_target
	),
	// Allow dwell clicking on a "Resume Dwell Clicking" button, while paused.
	dwellClickEvenIfPaused: (target) => (
		target.matches(".toggle-dwell-clicking-button")
	),
	// Define how to click on an element.
	click: ({ target, x, y }) => {
		if (target.matches("input[type='range']")) {
			// Special handling for sliders
			const rect = target.getBoundingClientRect();
			const vertical =
				target.getAttribute("orient") === "vertical" ||
				(getCurrentRotation(target) !== 0) ||
				rect.height > rect.width;
			const min = Number(target.min);
			const max = Number(target.max);
			const style = window.getComputedStyle(target);
			const isRTL = style.direction === "rtl";
			const fraction = vertical
				? (y - rect.top) / rect.height
				: (isRTL ? (rect.right - x) / rect.width : (x - rect.left) / rect.width);
			target.value = fraction * (max - min) + min;
			target.dispatchEvent(new Event("input", { bubbles: true }));
			target.dispatchEvent(new Event("change", { bubbles: true }));
		} else {
			// Normal click
			target.click();
			if (target.matches("input, textarea")) {
				target.focus();
			}
		}
	},
	// Handle untrusted gestures specially in external code.
	// Somewhere else, for example, you might do something like:
	// if (window.untrusted_gesture) {
	// 	// show download window
	// } else {
	// 	// show save file dialog with FS Access API
	// }
	// Recommended: use `event.isTrusted` instead, where possible.
	beforeDispatch: () => { window.untrusted_gesture = true; },
	afterDispatch: () => { window.untrusted_gesture = false; },
};
const dwellClicker = TrackyMouse.initDwellClicking(config);

// Integrate the Dwell Clicker and the UI's enabled state
// TODO: expose an event for when the UI toggles on/off
// and/or make the init API accept a dwell clicking config...
// I guess eventually it should just be a "clicking" config
// since the other clicking modes should be supported in the demo.
// For now, observe aria-pressed attribute as a hack
const observer = new MutationObserver(() => {
	const toggleButton = document.querySelector(".tracky-mouse-start-stop-button");
	const started = toggleButton.getAttribute("aria-pressed") === "true";
	dwellClicker.paused = !started;
});
// observer.observe(toggleButton, { attributes: true, attributeFilter: ["aria-pressed"] });
// The UI can now be re-initialized when switching languages, creating a new button
observer.observe(document.querySelector(".tracky-mouse-ui"), { childList: true, attributes: true, attributeFilter: ["aria-pressed"], subtree: true });


// Source: https://stackoverflow.com/a/54492696/2624876
function getCurrentRotation(el) {
	const st = window.getComputedStyle(el, null);
	const tm = st.getPropertyValue("-webkit-transform") ||
		st.getPropertyValue("-moz-transform") ||
		st.getPropertyValue("-ms-transform") ||
		st.getPropertyValue("-o-transform") ||
		st.getPropertyValue("transform") ||
		"none";
	if (tm !== "none") {
		const [a, b] = tm.split('(')[1].split(')')[0].split(',');
		return Math.round(Math.atan2(a, b) * (180 / Math.PI));
	}
	return 0;
}

// Pointer event simulation logic should be built into tracky-mouse in the future.
// These simulated events connect the Tracky Mouse head tracker to the Tracky Mouse dwell clicker,
// as well as any other pointermove/pointerenter/pointerleave handlers on the page.
const getEventOptions = ({ x, y }) => {
	return {
		view: window, // needed so the browser can calculate offsetX/Y from the clientX/Y
		clientX: x,
		clientY: y,
		pointerId: 1234567890, // a special value so other code can detect these simulated events
		pointerType: "mouse",
		isPrimary: true,
	};
};
let last_el_over = null;
TrackyMouse.onPointerMove = (x, y) => {
	const target = document.elementFromPoint(x, y) || document.body;
	if (target !== last_el_over) {
		if (last_el_over) {
			const event = new PointerEvent("pointerleave", Object.assign(getEventOptions({ x, y }), {
				button: 0,
				buttons: 1,
				bubbles: false,
				cancelable: false,
			}));
			last_el_over.dispatchEvent(event);
		}
		const event = new PointerEvent("pointerenter", Object.assign(getEventOptions({ x, y }), {
			button: 0,
			buttons: 1,
			bubbles: false,
			cancelable: false,
		}));
		target.dispatchEvent(event);
		last_el_over = target;
	}
	const event = new PointerEvent("pointermove", Object.assign(getEventOptions({ x, y }), {
		button: 0,
		buttons: 1,
		bubbles: true,
		cancelable: true,
	}));
	target.dispatchEvent(event);
};

// Archery mini-game
import("./archery-mini-game.js");

// Enhance demo link with smooth scrolling
document.querySelector('[href="#demo"]').addEventListener('click', function (event) {
	event.preventDefault();
	document.querySelector('#demo').scrollIntoView({ behavior: 'smooth' });
});