/* global TrackyMouse, electronAPI */
// const message = document.getElementById("tracky-mouse-screen-overlay-message");
// const actionSpan = document.getElementById("enable-disable");

// const bigButton = document.createElement("button");
// bigButton.style.position = "absolute";
// bigButton.style.top = "0";
// bigButton.style.left = "0";
// bigButton.style.width = "100%";
// bigButton.style.height = "100%";
// bigButton.style.backgroundColor = "transparent";
// bigButton.style.border = "none";
// bigButton.id = "button-that-takes-up-the-entire-screen";
// document.body.appendChild(bigButton);

// TrackyMouse.initDwellClicking({
// 	targets: "#button-that-takes-up-the-entire-screen",
// 	noCenter: (el) => el.matches("#button-that-takes-up-the-entire-screen"),
// 	click: ({ x, y }) => {
// 		electronAPI.mouseClick(x, y);
// 	},
// });

const cursorElement = document.createElement("div");
cursorElement.className = "laser-pointer";
document.body.appendChild(cursorElement);

electronAPI.onMouseMove((_event, x, y) => {
	cursorElement.style.left = `${x}px`;
	cursorElement.style.top = `${y}px`;
});
electronAPI.onMouseState((_event, state) => {
	console.log("onMouseState", state);
	cursorElement.style.display = state.visible ? "block" : "none";
});

const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("width", "100%");
svg.setAttribute("height", "100%");
svg.style.position = "fixed";
svg.style.top = "0";
svg.style.left = "0";
svg.style.pointerEvents = "none";
document.body.appendChild(svg);

let isDrawing = false;
let lastX = null, lastY = null;
const trails = [];

function createTrail(x1, y1, x2, y2) {
	const line = document.createElementNS(svgNS, "line");
	line.setAttribute("x1", x1);
	line.setAttribute("y1", y1);
	line.setAttribute("x2", x2);
	line.setAttribute("y2", y2);
	line.setAttribute("stroke", "red");
	line.setAttribute("stroke-width", "2");
	line.setAttribute("stroke-opacity", "1");
	svg.appendChild(line);

	const trail = { element: line, opacity: 1, createdAt: Date.now() };
	trails.push(trail);
}

function fadeTrails() {
	const now = Date.now();
	trails.forEach((trail, index) => {
		const elapsed = now - trail.createdAt;
		if (elapsed > 2000) {
			trail.opacity -= 0.02;
			trail.element.setAttribute("stroke-opacity", trail.opacity);
			if (trail.opacity <= 0) {
				svg.removeChild(trail.element);
				trails.splice(index, 1);
			}
		}
	});
	requestAnimationFrame(fadeTrails);
}
fadeTrails();

electronAPI.onMouseMove((_event, x, y) => {
	if (isDrawing && lastX !== null && lastY !== null) {
		createTrail(lastX, lastY, x, y);
	}
	lastX = x;
	lastY = y;
});

electronAPI.onMouseState((_event, state) => {
	isDrawing = state.visible;
	if (!isDrawing) {
		lastX = null;
		lastY = null;
	}
});


// let wasEnabled = false;
// electronAPI.onChangeDwellClicking((_event, isEnabled, isManualTakeback, cameraFeedDiagnostics) => {
// 	console.log("onChangeDwellClicking", isEnabled, isManualTakeback, cameraFeedDiagnostics);

// 	// Other diagnostics in the future would be stuff like:
// 	// - head too far away (smaller than a certain size) https://github.com/1j01/tracky-mouse/issues/49
// 	// - bad lighting conditions
// 	// see: https://github.com/1j01/tracky-mouse/issues/26

// 	document.body.classList.toggle("tracky-mouse-manual-takeback", isManualTakeback);
// 	document.body.classList.toggle("tracky-mouse-head-not-found", cameraFeedDiagnostics.headNotFound);
// 	actionSpan.innerText = isEnabled ? "disable" : "enable";

// 	if (!isEnabled && !isManualTakeback) {
// 		// Fade out the message after a little while so it doesn't get in the way.
// 		// TODO: make sure animation isn't interrupted by cameraFeedDiagnostics updates.
// 		message.style.animation = "tracky-mouse-screen-overlay-message-fade-out 2s ease-in-out forwards 10s";
// 	} else {
// 		message.style.animation = "";
// 		message.style.opacity = "1";
// 	}

// 	// "Trick" Tracky Mouse into stopping/starting the dwell clicker.
// 	// (TODO: can I use the return value of initDwellClicking instead? Or otherwise formalize this?)
// 	if (wasEnabled !== isEnabled) {
// 		document.dispatchEvent(new Event(isEnabled ? "mouseenter" : "mouseleave"));
// 		window.dispatchEvent(new Event(isEnabled ? "focus" : "blur"));
// 	}
// 	wasEnabled = isEnabled;
// });
