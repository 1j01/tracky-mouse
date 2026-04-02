import { autoscroll } from "./autoscroll.js";

// Pointer event simulation logic should be built into tracky-mouse in the future.
// These simulated events connect the Tracky Mouse head tracker to the Tracky Mouse dwell clicker,
// as well as any other pointermove/pointerenter/pointerleave/click handlers on the page.

/** a special value so other code can detect these simulated events */
export const TM_POINTER_ID = 1234567890;

export class InputSimulator {
	pointerId = TM_POINTER_ID;
	buttonStates = {
		0: false,
		1: false,
		2: false,
	};
	lastElOver = null;
	simulatedMousePosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	getEventOptions({ x, y }) {
		return {
			view: window, // needed so the browser can calculate offsetX/Y from the clientX/Y
			clientX: x,
			clientY: y,
			pointerId: this.pointerId,
			pointerType: "mouse",
			isPrimary: true,
		};
	}
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
	}
	pointerMove(x, y) {
		this.simulatedMousePosition = { x, y };
		// TODO: handle persistent button state
		const target = this.targetFromPoint(x, y);
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

		// TODO: support double click, triple click selection behaviors, dragging selection
		// TODO: avoid starting selection in links or other draggable/interactive elements
		if (this.textSelectionStart && this.buttonStates[0]) {
			const textSelectionEnd = this.caretPositionFromPoint(x, y);
			const selection = window.getSelection();
			if (textSelectionEnd && selection) {
				selection.setBaseAndExtent(
					this.textSelectionStart.offsetNode,
					this.textSelectionStart.offset,
					textSelectionEnd.offsetNode,
					textSelectionEnd.offset
				);
			}
		}

		autoscroll.pointerMove(target, x, y, this.pointerId);
	}
	pointerDown(target, x, y, buttonIndex = 0) {
		// TODO: handle nuance to moving across elements (nested elements, pointer capture)
		this.buttonStates[buttonIndex] = true;
		const event = new PointerEvent("pointerdown", Object.assign(this.getEventOptions({ x, y }), {
			button: buttonIndex,
			buttons: this.buttonStates[0] * 1 + this.buttonStates[1] * 2 + this.buttonStates[2] * 4,
			bubbles: true,
			cancelable: true,
		}));
		const result = target.dispatchEvent(event);
		this.pointerDownElement = target;

		// TODO: don't deselect when starting autoscroll
		// TODO: also dispatch mouse* events and let mousedown cancel selection too
		if (result) {
			window.getSelection()?.removeAllRanges();
			this.textSelectionStart = this.caretPositionFromPoint(x, y);
		} else {
			this.textSelectionStart = null;
		}
		// TODO: allow preventing MMB scroll? but make sure not to break
		// autoscroll ending behavior
		// FIXME: using gamepad, it fails to stop autoscroll with MMB because it starts immediately again
		autoscroll.pointerDown(target, x, y, buttonIndex, this.pointerId);
	}
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
			const contextMenuEvent = new MouseEvent("contextmenu", Object.assign(this.getEventOptions({ x, y }), {
				button: buttonIndex,
				bubbles: true,
				cancelable: true,
			}));
			const contextMenuEventResult = target.dispatchEvent(contextMenuEvent);
			if (contextMenuEventResult) {
				this.showContextMenu(target, x, y);
			}
		}
		this.pointerDownElement = null;

		// TODO: support also MMB to open links in a new tab
		autoscroll.pointerUp(target, x, y, buttonIndex, this.pointerId);
	}
	setMouseButtonState(buttonIndex, pressed) {
		if (this.buttonStates[buttonIndex] !== pressed) {
			const { x, y } = this.simulatedMousePosition;
			const target = this.targetFromPoint(x, y);
			if (pressed) {
				this.pointerDown(target, x, y, buttonIndex);
			} else {
				this.pointerUp(target, x, y, buttonIndex);
			}
		}
	}
	dropdownToCloseFunction = new WeakMap();
	openDropdown(dropdown, { focus = true } = {}) {
		if (this.dropdownToCloseFunction.has(dropdown)) {
			return; // avoid double opening
		}

		const flyout = document.createElement("ul");

		// fake button displayed on top just in case you use arrow keys, because the value shouldn't change in the original select
		// (an alternative hack might be to override `value` with a getter)
		const dropdownDisplayButton = dropdown.cloneNode(true);
		dropdownDisplayButton.value = dropdown.value;
		dropdownDisplayButton.style.pointerEvents = "none";

		const dropdownValueWhenOpened = dropdown.value;
		let dropdownValueToBeWhenClosed = dropdown.value;

		let highlightIndex = dropdown.selectedIndex;
		const buttons = [];
		function updateHighlightStyles() {
			for (let optionIndex = 0; optionIndex < buttons.length; optionIndex++) {
				buttons[optionIndex].style.backgroundColor = highlightIndex === optionIndex ? "Highlight" : "transparent";
				buttons[optionIndex].style.color = highlightIndex === optionIndex ? "HighlightText" : "";
			}
		}

		for (let optionIndex = 0; optionIndex < dropdown.options.length; optionIndex++) {
			const option = dropdown.options[optionIndex];
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
			button.addEventListener("pointerenter", () => {
				if (button.disabled) return;
				highlightIndex = buttons.indexOf(button);
				updateHighlightStyles();
			});
			button.addEventListener("click", () => {
				if (button.disabled) return;
				dropdownValueToBeWhenClosed = button.dataset.value;
				dropdownDisplayButton.value = button.dataset.value;
				this.closeDropdown(dropdown);
			});

			buttons.push(button);
		}
		updateHighlightStyles();

		document.body.append(flyout, dropdownDisplayButton);

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
		flyout.style.userSelect = "none";

		// Handle opening downwards, upwards or both directions as needed, limited to the full page height
		let animationFrameId = null;
		const positionElements = () => {
			const dropdownRect = dropdown.getBoundingClientRect();
			dropdownDisplayButton.style.position = "fixed";
			dropdownDisplayButton.style.top = `${dropdownRect.top}px`;
			dropdownDisplayButton.style.left = `${dropdownRect.left}px`;
			dropdownDisplayButton.style.width = `${dropdownRect.width}px`;
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
			animationFrameId = requestAnimationFrame(positionElements);
		};
		positionElements();

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
				highlightIndex = newIndex;
				updateHighlightStyles();
				buttons[newIndex].scrollIntoView({ block: "nearest", container: "nearest" });
				dropdownValueToBeWhenClosed = buttons[newIndex].dataset.value;
				dropdownDisplayButton.value = buttons[newIndex].dataset.value;
				event.preventDefault();
			}
		});
		let flyoutPointerDownOutsideHandler;
		addEventListener("pointerdown", flyoutPointerDownOutsideHandler = (event) => {
			if (!event.target?.closest || (event.target.closest("ul") !== flyout && event.target.closest("select") !== dropdown)) {
				this.closeDropdown(dropdown);
			}
		});

		flyout.addEventListener("pointerdown", (event) => {
			event.preventDefault(); // prevent starting text selection
		});
		flyout.addEventListener("contextmenu", (event) => {
			event.preventDefault();
		});

		const closeFunction = () => {
			cancelAnimationFrame(animationFrameId);
			removeEventListener("pointerdown", flyoutPointerDownOutsideHandler);
			if (!flyout || this._closingDropdown) {
				return;
			}
			this._closingDropdown = true; // TODO: should this flag be scoped to each dropdown or stay global?
			if (dropdownValueWhenOpened !== dropdownValueToBeWhenClosed) {
				dropdown.value = dropdownValueToBeWhenClosed;
				dropdown.dispatchEvent(new Event("input", { bubbles: true }));
				dropdown.dispatchEvent(new Event("change", { bubbles: true }));
			}
			flyout.remove(); // Can trigger blur event in Chromium-based browsers
			dropdownDisplayButton.remove();
			this._closingDropdown = false;
		};
		this.dropdownToCloseFunction.set(dropdown, closeFunction);
	}
	closeDropdown(dropdown) {
		this.dropdownToCloseFunction.get(dropdown)?.();
		this.dropdownToCloseFunction.delete(dropdown);
	}
	click(target, x, y) {
		if (target.matches("input[type='range']")) {
			// Special handling for sliders
			// TODO: support continuous dragging
			const rect = target.getBoundingClientRect();
			const vertical = target.getAttribute("orient") === "vertical" ||
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
				const newValue = target.options[Math.floor(fraction * target.options.length)].value;
				if (newValue !== target.value) {
					target.value = newValue;
					target.dispatchEvent(new Event("input", { bubbles: true }));
					target.dispatchEvent(new Event("change", { bubbles: true }));
				}
			} else if (this.dropdownToCloseFunction.has(target)) {
				this.closeDropdown(target);
			} else {
				this.openDropdown(target);
			}
		} else {
			// Normal click
			// HTMLElement has click() but SVGElement does not
			if (target.click) {
				target.click();
			} else {
				const event = new MouseEvent("click", Object.assign(this.getEventOptions({ x, y }), {
					button: 0,
					bubbles: true,
					cancelable: true,
				}));
				target.dispatchEvent(event);
			}
			if (target.matches("input, textarea")) {
				target.focus();
			}
		}
	}
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
		select.style.position = 'absolute';
		select.style.left = `${x + window.scrollX}px`;
		const height = 16; // arbitrary (but maybe not zero? and should be accounted for if it's not zero)
		select.style.height = `${height}px`;
		select.style.top = `${y - height + window.scrollY}px`;
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
	}
	showToast(message, position = this.simulatedMousePosition) {
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
	}
	caretPositionFromPoint(x, y) {
		// Firefox (standard)
		if (document.caretPositionFromPoint) {
			return document.caretPositionFromPoint(x, y);
		}
		// Chrome/Edge/Safari (non-standard)
		if (document.caretRangeFromPoint) {
			const range = document.caretRangeFromPoint(x, y);
			if (range) {
				return { offsetNode: range.startContainer, offset: range.startOffset };
			}
			return null;
		}
		throw new Error('Neither caretPositionFromPoint nor caretRangeFromPoint is supported.');
	}
	targetFromPoint(x, y) {
		const skip = ".tracky-mouse-click-through, .tracky-mouse-click-through *";
		const fallback = document.body; // would documentElement make more sense?

		let target = document.elementFromPoint(x, y);
		if (!target) {
			return fallback;
		}

		if (target.matches(skip)) {
			const elements = document.elementsFromPoint(x, y);
			target = elements.find(el => !el.matches(skip));
			if (!target) {
				return fallback;
			}
		}

		return target || fallback;
	}
}
