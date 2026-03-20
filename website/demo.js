/* global TrackyMouse */

TrackyMouse.dependenciesRoot = "./core";

await TrackyMouse.loadDependencies();

let dwellClicker = null;
let activeSettings = {};
let inputFeedback = {};
let systemMousePosition = {};
addEventListener("pointermove", (event) => {
	systemMousePosition = { x: event.clientX, y: event.clientY };
	updateHUD();
});

// Pointer event simulation logic should be built into tracky-mouse in the future.
// These simulated events connect the Tracky Mouse head tracker to the Tracky Mouse dwell clicker,
// as well as any other pointermove/pointerenter/pointerleave/click handlers on the page.
const inputSimulator = {
	buttonStates: {
		left: false,
		right: false,
		middle: false,
	},
	lastElOver: null,
	getEventOptions({ x, y }) {
		return {
			view: window, // needed so the browser can calculate offsetX/Y from the clientX/Y
			clientX: x,
			clientY: y,
			pointerId: 1234567890, // a special value so other code can detect these simulated events
			pointerType: "mouse",
			isPrimary: true,
		};
	},
	getCurrentRotation(el) {
		// Source: https://stackoverflow.com/a/54492696/2624876
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
	},
	pointerMove(x, y) {
		const target = document.elementFromPoint(x, y) || document.body;
		if (target !== this.lastElOver) {
			if (this.lastElOver) {
				const event = new PointerEvent("pointerleave", Object.assign(this.getEventOptions({ x, y }), {
					button: 0,
					buttons: 1,
					bubbles: false,
					cancelable: false,
				}));
				this.lastElOver.dispatchEvent(event);
			}
			const event = new PointerEvent("pointerenter", Object.assign(this.getEventOptions({ x, y }), {
				button: 0,
				buttons: 1,
				bubbles: false,
				cancelable: false,
			}));
			target.dispatchEvent(event);
			this.lastElOver = target;
		}
		const event = new PointerEvent("pointermove", Object.assign(this.getEventOptions({ x, y }), {
			button: 0,
			buttons: 1,
			bubbles: true,
			cancelable: true,
		}));
		target.dispatchEvent(event);
	},
	pointerDown(target, x, y) {
		// TODO: handle other buttons, nuance to moving across elements (nested elements, pointer capture)
		const event = new PointerEvent("pointerdown", Object.assign(this.getEventOptions({ x, y }), {
			button: 0,
			buttons: 1,
			bubbles: true,
			cancelable: true,
		}));
		target.dispatchEvent(event);
		this.pointerDownElement = target;
	},
	pointerUp(target, x, y) {
		// TODO: handle other buttons, nuance to moving across elements (nested elements, pointer capture), event cancelation
		const event = new PointerEvent("pointerup", Object.assign(this.getEventOptions({ x, y }), {
			button: 0,
			buttons: 0,
			bubbles: true,
			cancelable: true,
		}));
		target.dispatchEvent(event);
		if (this.pointerDownElement === target) {
			this.click(target, x, y);
		}
		this.pointerDownElement = null;
	},
	setMouseButtonState(buttonIndex, pressed) {
		if (buttonIndex !== 0) {
			// TODO: support right clicking (context menu), MMB auto-scrolling, MMB to open links in a new tab
			// For now, show a little note that fades away, at the cursor
			if (!pressed) {
				return;
			}
			const { x, y } = systemMousePosition;
			const note = document.createElement("div");
			// note.textContent = "Non-primary click not supported in demo";
			note.textContent = `${buttonIndex === 1 ? "Middle" : "Right"} click (demo)`;
			// note.textContent = `${buttonIndex === 1 ? "Middle" : "Right"} click works in desktop app`;
			note.style.position = "fixed";
			note.style.left = `${x}px`;
			note.style.top = `${y}px`;
			note.style.background = "rgba(0, 0, 0, 0.7)";
			note.style.color = "white";
			note.style.padding = "2px 5px";
			note.style.borderRadius = "3px";
			note.style.pointerEvents = "none";
			note.style.animation = "tracky-mouse-screen-overlay-message-fade-out 2s ease-in-out forwards 2s";
			document.body.appendChild(note);
			setTimeout(() => {
				note.remove();
			}, 4000);
			return;
		}
		if (this.buttonStates[buttonIndex] !== pressed) {
			const { x, y } = systemMousePosition;
			const target = document.elementFromPoint(x, y) || document.body;
			if (pressed) {
				this.pointerDown(target, x, y);
			} else {
				this.pointerUp(target, x, y);
			}
			this.buttonStates[buttonIndex] = pressed;
		}
	},
	openDropdown(dropdown) {
		// Idea to use size attribute from https://stackoverflow.com/a/19652333
		dropdown.setAttribute("size", String(dropdown.options.length));
		dropdown.style.marginBottom = `${-[...dropdown.options].reduce((acc, option) => acc + option.offsetHeight, 0)}px`;
		dropdown.style.zIndex = "100";
		dropdown.focus();
		dropdown.addEventListener("blur", () => {
			this.closeDropdown(dropdown);
		}, { once: true });
		addEventListener("pointerdown", (event) => {
			if (!event.target?.closest || !event.target.closest("select")) {
				this.closeDropdown(dropdown);
			}
		}, { once: true });
	},
	closeDropdown(dropdown) {
		dropdown.removeAttribute("size");
		dropdown.style.marginBottom = "";
		dropdown.style.zIndex = "";
	},
	click(target, x, y) {
		if (target.matches("input[type='range']")) {
			// Special handling for sliders
			const rect = target.getBoundingClientRect();
			const vertical =
				target.getAttribute("orient") === "vertical" ||
				(this.getCurrentRotation(target) !== 0) ||
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
		} else if (target.matches("option")) {
			const dropdown = target.closest("select");
			if (dropdown) {
				dropdown.value = target.value;
				this.closeDropdown(dropdown);
				dropdown.dispatchEvent(new Event("input", { bubbles: true }));
				dropdown.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (target.matches("select")) {
			// Special handling for dropdowns
			// TODO: don't assume size attribute is not used normally on the page
			if (target.getAttribute("size")) {
				// Fallback logic assuming all options are the same height
				// Do any browsers actually not give you <option> elements with document.getElementFromPoint?
				// I assumed they wouldn't when I wrote this, but it's great that they do, or Firefox does at least
				const rect = target.getBoundingClientRect();
				const fraction = (y - rect.top) / rect.height;
				target.value = target.options[Math.floor(fraction * target.options.length)].value;
				this.closeDropdown(target);
				target.dispatchEvent(new Event("input", { bubbles: true }));
				target.dispatchEvent(new Event("change", { bubbles: true }));
			} else {
				this.openDropdown(target);
			}
		} else {
			// Normal click
			target.click();
			if (target.matches("input, textarea")) {
				target.focus();
			}
		}
	},
};

const initOptions = {
	// All of these options are UNSTABLE
	updateInputFeedback: (data) => {
		inputFeedback = data;
		updateHUD();
	},
	setMouseButtonState: (buttonIndex, pressed) => {
		inputSimulator.setMouseButtonState(buttonIndex, pressed);
	},
	handleSettingsUpdate: (settings) => {
		// Sync settings from UI to `activeSettings`
		// This is not a very clean way of accessing settings.
		// TODO: DRY with deserializeSettings in electron-main.js
		// and avoid conflating serialized/deserialized settings
		// or provide a cleaner way of accessing active settings
		if ("globalSettings" in settings) {
			for (const key in settings.globalSettings) {
				if (settings.globalSettings[key] !== undefined) {
					activeSettings[key] = settings.globalSettings[key];
				}
			}
			if ("clickingMode" in settings.globalSettings) {
				updateDwellClickingEnabled();
			}
		}
	},
	clickingModeSupported: true,
};

// Note: init currently extends the passed element,
// rather than replacing it or adding a child to it.
// That is technically the most flexible, I suppose,
// but may violate the principle of least surprise.
// I could accept an options object with mutually exclusive options
// to `extend`, `replace`, or `appendTo`.
TrackyMouse.init(document.getElementById("tracky-mouse-demo"), initOptions);

// UNSTABLE API
const screenOverlay = TrackyMouse.initScreenOverlay();

// This example is based off of how JS Paint uses the Tracky Mouse API.
// It's simplified a bit, but includes various settings.
const config = {
	// The elements to click. Anything else is ignored.
	targets: `
		button:not([disabled]),
		input,
		textarea,
		select,
		select option,
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
		inputSimulator.click(target, x, y);
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
dwellClicker = TrackyMouse.initDwellClicking(config);

// Integrate the Dwell Clicker and the UI's enabled state
// TODO: expose an event for when the UI toggles on/off
// and/or make the init API accept a dwell clicking config...
// I guess eventually it should just be a "clicking" config
// since the other clicking modes should be supported in the demo.
// For now, observe aria-pressed attribute as a hack
const observer = new MutationObserver(() => {
	updateDwellClickingEnabled();
});
// observer.observe(toggleButton, { attributes: true, attributeFilter: ["aria-pressed"] });
// The UI can now be re-initialized when switching languages, creating a new button
observer.observe(document.querySelector(".tracky-mouse-ui"), { childList: true, attributes: true, attributeFilter: ["aria-pressed"], subtree: true });

function updateDwellClickingEnabled() {
	// This function can be called during the call to TrackyMouse.init
	// We could maybe init the dwell clicker before the UI to avoid the awkwardness of this early return and `dwellClicker` being non-constant.
	// But eventually the dwell clicker will be built in to the UI (albeit still configurable),
	// as the UI needs to manage different clicking modes, and this is a ridiculous amount of "glue code"
	// to support the basic features of Tracky Mouse.
	if (!dwellClicker) return;
	const toggleButton = document.querySelector(".tracky-mouse-start-stop-button");
	const started = toggleButton.getAttribute("aria-pressed") === "true";
	dwellClicker.paused = !started || activeSettings.clickingMode !== "dwell";
	updateHUD();
}
updateDwellClickingEnabled();

TrackyMouse.onPointerMove = (x, y) => {
	screenOverlay.updateMousePos(x, y); // UNSTABLE API
	inputSimulator.pointerMove(x, y);
};

function getScreenOverlayMessageText({ isManualTakeback, enabled }) {
	// TODO: share message logic with desktop app and support localization here
	/** translation placeholder */
	const t = (key, options = {}) => options.defaultValue ?? key;
	return isManualTakeback ?
		t("hud.willResumeAfterMouseStops", { defaultValue: "Will resume after mouse stops moving." }) :
		typeof enabled !== "boolean" ? t("hud.pressToToggle", { defaultValue: "Press %0 to toggle Tracky Mouse." }).replace("%0", "F9") :
			enabled ?
				t("hud.pressToDisable", { defaultValue: "Press %0 to disable Tracky Mouse." }).replace("%0", "F9") :
				t("hud.pressToEnable", { defaultValue: "Press %0 to enable Tracky Mouse." }).replace("%0", "F9");
}

function updateHUD() {
	const toggleButton = document.querySelector(".tracky-mouse-start-stop-button");
	const enabled = toggleButton && toggleButton.getAttribute("aria-pressed") === "true";
	// TODO: implement manual takeback in web version
	// https://github.com/1j01/tracky-mouse/issues/72
	const isManualTakeback = false;
	const bottomOffset = document.querySelector(".taskbar")?.offsetHeight || 0;
	// UNSTABLE API
	screenOverlay.update({
		isEnabled: enabled && !isManualTakeback,
		isManualTakeback,
		clickingMode: activeSettings.clickingMode,
		inputFeedback,
		bottomOffset,
		messageText: getScreenOverlayMessageText({ isManualTakeback, enabled }),
		systemMousePosition,
	});
}
updateHUD();

// Archery mini-game
import("./archery-mini-game.js");

// Enhance demo link with smooth scrolling
document.querySelector('[href="#demo"]').addEventListener('click', function (event) {
	event.preventDefault();
	document.querySelector('#demo').scrollIntoView({ behavior: 'smooth' });
});