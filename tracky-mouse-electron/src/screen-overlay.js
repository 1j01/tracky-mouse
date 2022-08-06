
const message = document.getElementById("tracky-mouse-screen-overlay-message");
const actionSpan = document.getElementById("enable-disable");

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

TrackyMouse.initDwellClicking({
	targets: "#button-that-takes-up-the-entire-screen",
	noCenter: (el) => el.matches("#button-that-takes-up-the-entire-screen"),
	click: ({ x, y }) => {
		electronAPI.mouseClick(x, y);
	},
});

electronAPI.onMouseMove((event, x, y) => {
	// console.log("move-mouse", x, y);
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
});

electronAPI.onChangeDwellClicking((event, isEnabled) => {
	// console.log("onChangeDwellClicking", isEnabled);
	actionSpan.innerText = isEnabled ? "disable" : "enable";

	if (!isEnabled) {
		// Fade out the message after a little while so it doesn't get in the way.
		message.style.animation = "tracky-mouse-screen-overlay-message-fade-out 2s ease-in-out forwards 10s";
	} else {
		message.style.animation = "";
		message.style.opacity = "1";
	}

	// "Trick" Tracky Mouse into stopping/starting the dwell clicker.
	document.dispatchEvent(new Event(isEnabled ? "mouseenter" : "mouseleave"));
	window.dispatchEvent(new Event(isEnabled ? "focus" : "blur"));
});
