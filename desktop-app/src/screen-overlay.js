/* global TrackyMouse, electronAPI */

/** translation placeholder */
const t = (s) => s;

const message = document.getElementById("tracky-mouse-screen-overlay-message");
const actionSpan = document.getElementById("enable-disable");

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
		electronAPI.mouseClick(x, y);
	},
});

const inputFeedbackCanvas = document.createElement("canvas");
inputFeedbackCanvas.style.position = "absolute";
inputFeedbackCanvas.style.top = "0";
inputFeedbackCanvas.style.left = "0";
inputFeedbackCanvas.style.pointerEvents = "none";
inputFeedbackCanvas.width = 32;
inputFeedbackCanvas.height = 32;
document.body.appendChild(inputFeedbackCanvas);
const inputFeedbackCtx = inputFeedbackCanvas.getContext("2d");
function drawInputFeedback({ inputFeedback, isEnabled }) {
	const { blinkInfo, mouthInfo } = inputFeedback;
	inputFeedbackCtx.clearRect(0, 0, inputFeedbackCanvas.width, inputFeedbackCanvas.height);
	if (!isEnabled) {
		return;
	}
	// draw meters for blink and mouth openness
	// TODO: draw meter backings to disambiguate showing zero vs being occluded by taskbar
	// (Ideally it should stay on top of the taskbar and context menus all the time
	// 	but that's another issue: https://github.com/1j01/tracky-mouse/issues/14)
	const drawMeter = (x, yCenter, width, height, { active, thresholdMet }) => {
		inputFeedbackCtx.fillStyle = active ? "red" : thresholdMet ? "yellow" : "cyan";
		inputFeedbackCtx.fillRect(x, yCenter - height / 2, width, height);
	};
	if (blinkInfo?.used) {
		for (const eye of [blinkInfo.leftEye, blinkInfo.rightEye]) {
			drawMeter(eye === blinkInfo.leftEye ? 5 : 20, 5, 10, Math.max(2, 20 * eye.heightRatio), eye);
		}
	}
	if (mouthInfo?.used) {
		drawMeter(0, 20, 23, Math.max(2, 40 * mouthInfo.heightRatio), mouthInfo);
	}
}

electronAPI.onMouseMove((_event, x, y) => {
	// console.log("moveMouse", x, y);
	document.dispatchEvent(new Event("mouseenter"));
	const domEvent = new PointerEvent("pointermove", {
		view: window,
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: "mouse",
		isPrimary: true,
		button: 0,
		buttons: 1,
		bubbles: true,
		cancelable: true,
	});
	window.dispatchEvent(domEvent);
	// inputFeedbackCanvas.style.transform = `translate(${x - inputFeedbackCanvas.width / 2}px, ${y - inputFeedbackCanvas.height / 2}px)`;
	// inputFeedbackCanvas.style.transform = `translate(${x}px, ${y}px)`;
	inputFeedbackCanvas.style.transform = `translate(${Math.min(x, window.innerWidth - inputFeedbackCanvas.width)}px, ${Math.min(y, window.innerHeight - inputFeedbackCanvas.height)}px)`;
});

let wasDwellClickerEnabled = false;
electronAPI.onOverlayUpdate((_event, data) => {
	console.log("onOverlayUpdate", data);
	const { isEnabled, isManualTakeback, clickingMode, inputFeedback, bottomOffset } = data;

	message.style.bottom = `${bottomOffset}px`;

	// Other diagnostics in the future would be stuff like:
	// - head too far away (smaller than a certain size) https://github.com/1j01/tracky-mouse/issues/49
	// - bad lighting conditions
	// see: https://github.com/1j01/tracky-mouse/issues/26

	document.body.classList.toggle("tracky-mouse-manual-takeback", isManualTakeback);
	document.body.classList.toggle("tracky-mouse-head-not-found", inputFeedback.headNotFound);
	actionSpan.innerText = isEnabled ? t("disable") : t("enable");

	if (!isEnabled && !isManualTakeback) {
		// Fade out the message after a little while so it doesn't get in the way.
		// TODO: make sure animation isn't interrupted by inputFeedback updates.
		message.style.animation = "tracky-mouse-screen-overlay-message-fade-out 2s ease-in-out forwards 10s";
	} else {
		message.style.animation = "";
		message.style.opacity = "1";
	}

	// "Trick" Tracky Mouse into stopping/starting the dwell clicker.
	// Update: I'm now setting `dwellClicker.paused`, just keeping the event dispatching
	// in case it's needed to cancel a dwell click in progress.
	// TODO: ensure settings `paused` to `true` cancels any in-progress dwell click.
	const dwellClickerEnabled = isEnabled && clickingMode === "dwell";
	if (wasDwellClickerEnabled !== dwellClickerEnabled) {
		document.dispatchEvent(new Event(dwellClickerEnabled ? "mouseenter" : "mouseleave"));
		window.dispatchEvent(new Event(dwellClickerEnabled ? "focus" : "blur"));
	}
	dwellClicker.paused = !dwellClickerEnabled;
	wasDwellClickerEnabled = dwellClickerEnabled;

	drawInputFeedback(data);
});
