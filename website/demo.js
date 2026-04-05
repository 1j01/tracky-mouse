/* global TrackyMouse */

import { InputSimulator } from "./input-simulator.js";

TrackyMouse.dependenciesRoot = "./core";

await TrackyMouse.loadDependencies();


// Allow controlling the mouse, but pause if the mouse is moved normally.
// TODO: bring this logic into the core
// https://github.com/1j01/tracky-mouse/issues/72
const thresholdToRegainControl = 10; // in pixels
const regainControlForTime = 2000; // in milliseconds, AFTER the mouse hasn't moved for more than mouseMoveRequestHistoryDuration milliseconds (I think)
let regainControlTimeout = null; // also used to check if we're pausing temporarily
let systemMousePosition = null;
const mousePosHistoryDuration = 5000; // in milliseconds; affects time to switch back to camera control after manual mouse movement (although maybe it shouldn't)
const mousePosHistory = [];
function pruneMousePosHistory() {
	const now = performance.now();
	while (mousePosHistory[0] && now - mousePosHistory[0].time > mousePosHistoryDuration) {
		mousePosHistory.shift();
	}
}

let dwellClicker = null;
export let activeSettings = {};
let inputFeedback = {};
let mousePosition = {};
addEventListener("pointermove", (event) => {
	mousePosition = { x: event.clientX, y: event.clientY };
	if (event.isTrusted) {
		systemMousePosition = { ...mousePosition };

		const curPos = systemMousePosition; // (name used in electron-main.js)
		pruneMousePosHistory();
		const distances = mousePosHistory.map(({ point }) => Math.hypot(curPos.x - point.x, curPos.y - point.y));
		const distanceMoved = distances.length ? Math.min(...distances) : 0;
		// console.log("distanceMoved", distanceMoved, "mousePosHistory", mousePosHistory, "distances", distances);
		if (distanceMoved > thresholdToRegainControl) {
			// if (regainControlTimeout === null) {
			// 	console.log("mousePosHistory", mousePosHistory);
			// 	console.log("distances", distances);
			// 	console.log("distanceMoved", distanceMoved, ">", thresholdToRegainControl, "curPos", curPos, "last pos", mousePosHistory[mousePosHistory.length - 1], "mousePosHistory.length", mousePosHistory.length);
			// 	console.log("Pausing camera control due to manual mouse movement.");
			// }
			clearTimeout(regainControlTimeout);
			regainControlTimeout = setTimeout(() => {
				regainControlTimeout = null; // used to check if we're pausing
				// console.log("Mouse not moved for", regainControlForTime, "ms; resuming.");
				updateDwellClickingEnabled();
			}, regainControlForTime);
			updateDwellClickingEnabled();
		}
		mousePosHistory.push({ point: { x: curPos.x, y: curPos.y }, time: performance.now(), from: "pointermove" });
	}
	updateHUD();
});

// Pointer event simulation logic should be built into tracky-mouse in the future.
// These simulated events connect the Tracky Mouse head tracker to the Tracky Mouse dwell clicker,
// as well as any other pointermove/pointerenter/pointerleave/click handlers on the page.
const inputSimulator = window.inputSimulator = new InputSimulator();

const initOptions = {
	// All of these options are UNSTABLE
	// HUD support and support for clicking modes other than dwell clicking
	// should eventually be built in by default.
	// These options glue the systems together which previously
	// were only desktop app features, as a proof of concept
	// which is very helpful on the path to bringing it into the API.
	// If you do decide to copy from this demo, make sure to pin tracky-mouse to
	// an exact version, and expect breaking changes in any update.
	updateInputFeedback: (data) => {
		inputFeedback = data;
		updateHUD();
	},
	setMouseButtonState: (buttonIndex, pressed) => {
		if (regainControlTimeout !== null) {
			return false;
		}
		return inputSimulator.setMouseButtonState(buttonIndex, pressed);
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
	notifyToggleState: () => {
		// Start immediately if enabled.
		clearTimeout(regainControlTimeout);
		regainControlTimeout = null;
		mousePosHistory.length = 0;

		// Integrate the Dwell Clicker and the UI's enabled state
		// TODO: make the init API create/manage the dwell clicker,
		// and accept clicking configuration
		updateDwellClickingEnabled();
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
		#drawing-pad-demo svg,
		.window:not(.maximized) .window-titlebar
	`,
	// Filter for elements to drag. They must be included in the targets first.
	shouldDrag: (target) => (
		target.matches(".window-titlebar") ||
		target.matches("#drawing-pad-demo svg") // (... && current_tool.supports_drag)
	),
	// Instead of clicking in the center of these elements, click at any point within the element.
	// This is useful for drag offsets, like for a window titlebar,
	// and position-based inputs like sliders or color pickers, or a drawing canvas.
	noCenter: (target) => (
		target.matches(`
			input[type="range"],
			#drawing-pad-demo svg,
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
		if (regainControlTimeout !== null) {
			return;
		}
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

function isEnabled() {
	// HACK, TODO: get state from proper channel
	const toggleButton = document.querySelector(".tracky-mouse-start-stop-button");
	return toggleButton?.getAttribute("aria-pressed") === "true";
}

function updateDwellClickingEnabled() {
	// This function can be called during the call to TrackyMouse.init
	// We could maybe init the dwell clicker before the UI to avoid the awkwardness of this early return and `dwellClicker` being non-constant.
	// But eventually the dwell clicker will be built in to the UI (albeit still configurable),
	// as the UI needs to manage different clicking modes, and this is a ridiculous amount of "glue code"
	// to support the basic features of Tracky Mouse.
	if (!dwellClicker) return;
	const enabled = isEnabled();
	dwellClicker.paused = !enabled || activeSettings.clickingMode !== "dwell" || regainControlTimeout !== null;
	const virtualCursor = document.querySelector(".tracky-mouse-pointer");
	virtualCursor.style.opacity = (enabled && regainControlTimeout === null) ? "" : "0.2";
	updateHUD();
}
updateDwellClickingEnabled();

TrackyMouse.onPointerMove = (x, y) => {
	if (regainControlTimeout !== null) {
		return;
	}
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
	const enabled = isEnabled();
	const isManualTakeback = enabled && regainControlTimeout !== null;
	const bottomOffset = document.querySelector(".taskbar")?.offsetHeight || 0;
	// UNSTABLE API
	screenOverlay.update({
		isEnabled: enabled && !isManualTakeback,
		isManualTakeback,
		clickingMode: activeSettings.clickingMode,
		inputFeedback,
		bottomOffset,
		messageText: getScreenOverlayMessageText({ isManualTakeback, enabled }),
		systemMousePosition: mousePosition,
	});
}
updateHUD();

// Archery mini-game
import("./archery-mini-game.js");

// Canvas demo
if (location.search.match(/\b(canvas|drawing)\b/)) {
	import("./drawing-pad-demo.js").then(({ DrawingPad }) => {
		new DrawingPad("drawing-pad-demo");
	});
	for (const element of document.querySelectorAll(".drawing-pad-demo-visibility")) {
		element.removeAttribute("hidden");
	}
}

// Gamepad as mouse support, for comparison in archery mini-game
window.addEventListener("gamepadconnected", () => {
	import("./gamepad-mouse.js").then(({ updateGamepadMouse }) => {
		function gamepadLoop() {
			updateGamepadMouse();
			requestAnimationFrame(gamepadLoop);
		}
		requestAnimationFrame(gamepadLoop);
	});
}, { once: true });

// Enhance demo link with smooth scrolling
document.querySelector('[href="#demo"]').addEventListener('click', function (event) {
	event.preventDefault();
	document.querySelector('#demo').scrollIntoView({ behavior: 'smooth' });
});