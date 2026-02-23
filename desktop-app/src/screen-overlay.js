/* global TrackyMouse, electronAPI */

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

const screenOverlay = TrackyMouse.initScreenOverlay();

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
	screenOverlay.updateMousePos(x, y);
});

let wasDwellClickerEnabled = false;
electronAPI.onOverlayUpdate((_event, data) => {
	// console.log("onOverlayUpdate", data);
	const { isEnabled, clickingMode } = data;

	screenOverlay.update(data);

	// "Trick" Tracky Mouse into stopping/starting the dwell clicker.
	// Update: I'm now setting `dwellClicker.paused`, just keeping the event dispatching
	// in case it's needed to cancel a dwell click in progress.
	// TODO: ensure setting `paused` to `true` cancels any in-progress dwell click.
	const dwellClickerEnabled = isEnabled && clickingMode === "dwell";
	if (wasDwellClickerEnabled !== dwellClickerEnabled) {
		document.dispatchEvent(new Event(dwellClickerEnabled ? "mouseenter" : "mouseleave"));
		window.dispatchEvent(new Event(dwellClickerEnabled ? "focus" : "blur"));
	}
	dwellClicker.paused = !dwellClickerEnabled;
	wasDwellClickerEnabled = dwellClickerEnabled;

});
