/* global electronAPI */

import { TrackyMouse } from "../node_modules/tracky-mouse/src/tracky-mouse.js";

let audio = null;

// I like bigButton and I cannot lie
const bigButton = document.createElement("button");
bigButton.style.position = "absolute";
bigButton.style.top = "0";
bigButton.style.left = "0";
bigButton.style.width = "100%";
bigButton.style.height = "100%";
bigButton.style.backgroundColor = "transparent";
bigButton.style.border = "none";
bigButton.id = "button-that-takes-up-the-entire-screen";
document.body.appendChild(bigButton);

const dwellClicker = TrackyMouse.initDwellClicking({
	targets: "#button-that-takes-up-the-entire-screen",
	noCenter: (el) => el.matches("#button-that-takes-up-the-entire-screen"),
	click: ({ x, y }) => {
			electronAPI.mouseClick();

		audio?.playSound("clickPress");
		setTimeout(() => audio?.playSound("clickRelease"), 100);
	},
});

const screenOverlay = TrackyMouse.initScreenOverlay();

let mouseX = 0;
let mouseY = 0;
electronAPI.onMouseMove((_event, deltaX, deltaY) => {
	mouseX += deltaX;
	mouseY += deltaY;
	document.dispatchEvent(new Event("mouseenter"));
	const domEvent = new PointerEvent("pointermove", {
		view: window,
		clientX: mouseX,
		clientY: mouseY,
		pointerId: 1,
		pointerType: "mouse",
		isPrimary: true,
		button: 0,
		buttons: 1,
		bubbles: true,
		cancelable: true,
	});
	window.dispatchEvent(domEvent);
	screenOverlay.updateMousePos(mouseX, mouseY);
});

electronAPI.onOverlayUpdate((_event, data) => {
	// console.log("onOverlayUpdate", data);
	const { isEnabled, clickingMode, soundEffectsEnabled, inputFeedback } = data;

	screenOverlay.update(data);
	if (data.systemMousePosition) {
		mouseX = data.systemMousePosition.x;
		mouseY = data.systemMousePosition.y;
	}

	const pauseDwellClickingDueToJoystickUsage = inputFeedback.virtualJoystickInfo?.active;
	const dwellClickerEnabled = isEnabled && clickingMode === "dwell" && !pauseDwellClickingDueToJoystickUsage;
	dwellClicker.paused = !dwellClickerEnabled;

	audio?.setAudioEnabled(soundEffectsEnabled);

});
