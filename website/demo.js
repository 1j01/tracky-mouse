/* global TrackyMouse */

TrackyMouse.dependenciesRoot = "./core";

await TrackyMouse.loadDependencies();

let dwellClicker = null;
let activeSettings = {};
let inputFeedback = {};
let mousePosition = {};
addEventListener("pointermove", (event) => {
	mousePosition = { x: event.clientX, y: event.clientY };
	updateHUD();
});

// Pointer event simulation logic should be built into tracky-mouse in the future.
// These simulated events connect the Tracky Mouse head tracker to the Tracky Mouse dwell clicker,
// as well as any other pointermove/pointerenter/pointerleave/click handlers on the page.
const inputSimulator = window.inputSimulator = {
	buttonStates: {
		0: false,
		1: false,
		2: false,
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
	pointerDown(target, x, y, buttonIndex = 0) {
		// TODO: handle nuance to moving across elements (nested elements, pointer capture)
		this.buttonStates[buttonIndex] = true;
		const event = new PointerEvent("pointerdown", Object.assign(this.getEventOptions({ x, y }), {
			button: buttonIndex,
			buttons: this.buttonStates[0] * 1 + this.buttonStates[1] * 2 + this.buttonStates[2] * 4,
			bubbles: true,
			cancelable: true,
		}));
		target.dispatchEvent(event);
		this.pointerDownElement = target;
	},
	pointerUp(target, x, y, buttonIndex = 0) {
		// TODO: handle nuance to moving across elements (nested elements, pointer capture), event cancellation?
		this.buttonStates[buttonIndex] = false;
		const event = new PointerEvent("pointerup", Object.assign(this.getEventOptions({ x, y }), {
			button: buttonIndex,
			buttons: this.buttonStates[0] * 1 + this.buttonStates[1] * 2 + this.buttonStates[2] * 4,
			bubbles: true,
			cancelable: true,
		}));
		target.dispatchEvent(event);
		if (buttonIndex === 0) {
			if (this.pointerDownElement === target) {
				this.click(target, x, y);
			}
		} else if (buttonIndex === 2) {
			this.showContextMenu(target, x, y);
		}
		this.pointerDownElement = null;
	},
	setMouseButtonState(buttonIndex, pressed) {
		if (buttonIndex !== 0 && buttonIndex !== 2) {
			// TODO: support MMB auto-scrolling, MMB to open links in a new tab
			// For now, show a little note that fades away, at the cursor
			if (!pressed) {
				return;
			}
			// const message = "Non-primary click not supported in demo";
			const message = `${buttonIndex === 1 ? "Middle" : "Right"} click (demo)`;
			// const message = `${buttonIndex === 1 ? "Middle" : "Right"} click works in desktop app`;
			// const message = "Middle mouse button pressed"
			this.showToast(message);
			return;
		}
		if (this.buttonStates[buttonIndex] !== pressed) {
			const { x, y } = mousePosition;
			const target = document.elementFromPoint(x, y) || document.body;
			if (pressed) {
				this.pointerDown(target, x, y, buttonIndex);
			} else {
				this.pointerUp(target, x, y, buttonIndex);
			}
		}
	},
	dropdownToFlyout: new WeakMap(),
	flyoutToDropdown: new WeakMap(),
	openDropdown(dropdown, { focus = true } = {}) {
		const flyout = document.createElement("ul");
		this.dropdownToFlyout.set(dropdown, flyout);
		this.flyoutToDropdown.set(flyout, dropdown);

		let highlightIndex = -1;
		const buttons = [];

		for (const option of dropdown.options) {
			const li = document.createElement("li");
			flyout.append(li);
			const button = document.createElement("button");
			button.textContent = option.textContent;
			button.dataset.value = option.value;
			button.disabled = option.disabled;
			li.append(button);
			button.style.padding = "5px";
			button.style.border = "none";
			button.style.width = "100%";
			button.style.textAlign = "left";
			button.style.display = "block";
			button.style.cssText += option.style.cssText;

			// Hover effect
			// assuming no background by default, so enforce it for consistency
			button.style.backgroundColor = "transparent";
			button.addEventListener("pointerenter", () => {
				if (button.disabled) return;
				if (buttons[highlightIndex]) {
					buttons[highlightIndex].style.backgroundColor = "transparent";
				}
				highlightIndex = buttons.indexOf(button);
				button.style.backgroundColor = "#e0e0e0";
			});
			button.addEventListener("click", () => {
				if (button.disabled) return;
				dropdown.value = button.dataset.value;
				this.closeDropdown(dropdown);
			});

			buttons.push(button);
		}

		document.body.append(flyout);

		flyout.style.zIndex = "100";
		flyout.style.overflow = "auto";
		flyout.style.background = "white";
		flyout.style.color = "black";
		flyout.style.border = "1px solid gray";
		flyout.style.outline = "0";
		flyout.style.padding = "0";
		flyout.style.margin = "0";
		flyout.style.listStyle = "none";
		flyout.style.boxSizing = "border-box";

		// Handle opening downwards, upwards or both directions as needed, limited to the full page height
		// TODO: reposition as page is scrolled etc.
		const dropdownRect = dropdown.getBoundingClientRect();
		flyout.style.position = "fixed";
		flyout.style.top = `${dropdownRect.bottom}px`;
		flyout.style.left = `${dropdownRect.left}px`;
		flyout.style.width = `${dropdownRect.width}px`;
		if (flyout.getBoundingClientRect().bottom > window.innerHeight) {
			flyout.style.top = `${dropdownRect.top - flyout.getBoundingClientRect().height}px`;
		}
		if (flyout.getBoundingClientRect().top < 0) {
			flyout.style.top = "0px";
		}
		flyout.style.maxHeight = "100vh";

		flyout.tabIndex = 0;
		if (focus) {
			flyout.focus();
			flyout.addEventListener("blur", () => {
				this.closeDropdown(dropdown);
			}, { once: true });
		}
		flyout.addEventListener("keydown", (event) => {
			// TODO: should Esc/Enter be global? (maybe even arrow keys?)
			if (event.key === "Escape" || event.key === "Enter") {
				this.closeDropdown(dropdown);
			}
			const dx = (event.key === "ArrowRight") - (event.key === "ArrowLeft");
			const dy = (event.key === "ArrowDown") - (event.key === "ArrowUp");
			if (dy !== 0 || dx !== 0) {
				const newIndex = highlightIndex === -1 ? 0 : ((highlightIndex + dy + buttons.length) % buttons.length);
				if (highlightIndex !== -1) {
					buttons[highlightIndex].style.backgroundColor = "transparent";
				}
				buttons[newIndex].style.backgroundColor = "#e0e0e0";
				buttons[newIndex].scrollIntoView({ block: "nearest" });
				highlightIndex = newIndex;
				dropdown.value = buttons[newIndex].dataset.value;
				dropdown.dispatchEvent(new Event("input", { bubbles: true }));
				event.preventDefault();
			}
		});
		addEventListener("pointerdown", (event) => {
			if (!event.target?.closest || (event.target.closest("ul") !== flyout && event.target.closest("select") !== dropdown)) {
				this.closeDropdown(dropdown);
			}
		}, { once: true });
	},
	closeDropdown(dropdown) {
		const flyout = this.dropdownToFlyout.get(dropdown);
		if (!flyout || this._closingDropdown) {
			return;
		}
		this._closingDropdown = true;
		dropdown.dispatchEvent(new Event("input", { bubbles: true }));
		dropdown.dispatchEvent(new Event("change", { bubbles: true }));
		flyout.remove(); // Can trigger blur event in Chromium-based browsers
		this.dropdownToFlyout.delete(dropdown);
		this.flyoutToDropdown.delete(flyout);
		this._closingDropdown = false;
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
			const select = target.closest("select");
			if (select) {
				select.value = target.value;
				select.dispatchEvent(new Event("input", { bubbles: true }));
				select.dispatchEvent(new Event("change", { bubbles: true }));
			}
		} else if (target.matches("select")) {
			// Special handling for dropdowns
			if (target.getAttribute("size")) {
				// Fallback logic assuming all options are the same height
				// Do any browsers actually not give you <option> elements with document.getElementFromPoint?
				// I assumed they wouldn't when I wrote this, but it's great that they do, or Firefox does at least
				const rect = target.getBoundingClientRect();
				const fraction = (y - rect.top) / rect.height;
				target.value = target.options[Math.floor(fraction * target.options.length)].value;
				target.dispatchEvent(new Event("input", { bubbles: true }));
				target.dispatchEvent(new Event("change", { bubbles: true }));
			} else if (this.dropdownToFlyout.has(target)) {
				this.closeDropdown(target);
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
	showContextMenu(target, x, y) {
		const commands = ["copy", "cut", "paste", "delete", "selectAll", "undo", "redo"];
		const supportedCommands = commands.filter(cmd => document.queryCommandSupported(cmd));
		const enabledCommands = supportedCommands.filter(cmd => document.queryCommandEnabled(cmd));
		console.log({ supportedCommands, enabledCommands });

		const execCommandItem = (label, command) => {
			return {
				label,
				visible: supportedCommands.includes(command),
				enabled: enabledCommands.includes(command),
				action: () => document.execCommand(command),
			};
		};

		const menuItems = [
			// TODO: avoid executing first item when dismissing context menu
			// For now, include a no-op first item
			{ label: '' }, // not enabled: false so that another item isn't highlighted with a gray background

			{
				label: 'Open Link in New Tab',
				visible: target.matches("a[href]"),
				action: () => {
					const a = target?.closest('a');
					if (a?.href) {
						return !!window.open(a.href, '_blank');
					}
				}
			},
			{ separator: true, visible: target.matches("a[href]") },

			execCommandItem('Copy', 'copy'),
			execCommandItem('Cut', 'cut'),
			execCommandItem('Paste', 'paste'),
			execCommandItem('Delete', 'delete'),
			execCommandItem('Select All', 'selectAll'),

		];

		// Create an invisible select element for context menu positioning, in order to reuse the dropdown code
		const select = document.createElement('select');
		select.style.position = 'fixed';
		select.style.left = `${x}px`;
		const height = 16; // arbitrary (but maybe not zero? and should be accounted for if it's not zero)
		select.style.height = `${height}px`;
		select.style.top = `${y - height}px`;
		select.style.opacity = '0';
		select.style.pointerEvents = 'none';
		select.tabIndex = -1;

		const optionToMenuItem = new WeakMap();
		for (const item of menuItems) {
			if (item.visible === false) {
				continue;
			}
			const option = document.createElement('option');
			option.textContent = item.label;
			option.disabled = item.enabled === false || item.separator === true;
			if (!item.label) {
				option.style.fontSize = '0';
				option.style.padding = '0';
			}
			if (item.separator) {
				option.style.borderTop = '1px solid #ccc';
				option.style.fontSize = '4px';
				option.style.marginTop = '4px';
			}
			select.appendChild(option);
			optionToMenuItem.set(option, item);
		}

		document.body.appendChild(select);
		// technically the dropdown should have focus, but
		// 1. this is an interface to allow for (virtual-)mouse-only access, so keyboard is not so important
		// 2. I think it's more important to keep showing the selection you're about to copy/cut/delete
		target.focus();
		this.openDropdown(select, { focus: false });

		select.addEventListener("change", () => {
			const item = optionToMenuItem.get(select.options[select.selectedIndex]);
			select.remove();
			target.focus();
			if (item.action && item.enabled !== false) {
				const result = item.action();
				this.showToast(item.label + (result === false ? " not allowed" : ""));
			}
		}, { once: true });

		// FIXME: menu can be stuck open
	},
	showToast(message, position = mousePosition) {
		const { x, y } = position;
		const toast = document.createElement("div");
		toast.textContent = message;
		toast.style.position = "fixed";
		toast.style.left = `${x}px`;
		toast.style.top = `${y}px`;
		toast.style.background = "rgba(0, 0, 0, 0.7)";
		toast.style.color = "white";
		toast.style.padding = "2px 5px";
		toast.style.borderRadius = "3px";
		toast.style.pointerEvents = "none";
		toast.style.animation = "tracky-mouse-fade-out 2s ease-in-out forwards 2s";
		document.body.appendChild(toast);
		setTimeout(() => {
			toast.remove();
		}, 4000);
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
	notifyToggleState: () => {
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
		systemMousePosition: mousePosition,
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