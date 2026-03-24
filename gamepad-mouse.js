import { InputSimulator } from "./input-simulator.js";

export const GAMEPAD_POINTER_ID = 1122343409;

const inputSimulator = new InputSimulator();
inputSimulator.pointerId = GAMEPAD_POINTER_ID;

const pointer = document.createElement("div");
document.body.appendChild(pointer);
pointer.id = "gamepad-mouse-pointer";
pointer.textContent = "🎮";
pointer.style.position = "fixed";
pointer.style.pointerEvents = "none";
pointer.style.userSelect = "none";
pointer.style.zIndex = "800000";
pointer.style.fontSize = "24px";
pointer.style.lineHeight = "24px";
// Arrow-like border (a triangle would be a bit nicer)
pointer.style.border = "2px solid yellow";
pointer.style.borderRight = pointer.style.borderBottom = "none";
pointer.style.width = pointer.style.height = "10px";
pointer.style.filter = "drop-shadow(1px 1px 1px black)";

const deadZone = 0.15;
const maxSpeed = 1; // pixels per millisecond
const maxScrollSpeed = 1.5; // pixels per millisecond
const maxDeltaTime = 100; // milliseconds

const gamepadToPointerButtonMap = {
	0: 0, // A -> left click
	1: 2, // B -> right click
	2: 1, // X -> middle click
};
let gamepadMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastTimestamp = null;
let prevButtons = [];
let currentButtons = [];
let clickTimer = -Infinity;
let targeting = false;
let targetingIndicators = [];

function applyDeadZone(value, deadZone) {
	if (Math.abs(value) < deadZone) return 0;
	return (value - Math.sign(value) * deadZone) / (1 - deadZone);
}

export function updateGamepadMouse() {
	const gamepads = navigator.getGamepads();
	const gp = gamepads[0];
	if (!gp) return;

	const now = performance.now();

	if (lastTimestamp === null) {
		lastTimestamp = now;
		return;
	}

	const deltaTime = Math.min(maxDeltaTime, now - lastTimestamp);
	lastTimestamp = now;

	const prevGamepadMousePos = { ...gamepadMousePos };

	let xAxis = gp.axes[0];
	let yAxis = gp.axes[1];
	let xAxisForPanning = gp.axes[2];
	let yAxisForPanning = gp.axes[3];

	// Apply dead zone
	xAxis = applyDeadZone(xAxis, deadZone);
	yAxis = applyDeadZone(yAxis, deadZone);
	xAxisForPanning = applyDeadZone(xAxisForPanning, deadZone);
	yAxisForPanning = applyDeadZone(yAxisForPanning, deadZone);

	gamepadMousePos.x += xAxis * maxSpeed * deltaTime;
	gamepadMousePos.y += yAxis * maxSpeed * deltaTime;

	// Clamp to screen bounds
	// (1px padding avoids failing to click at the edge of the screen (at least the bottom))
	gamepadMousePos.x = Math.max(1, Math.min(window.innerWidth - 1, gamepadMousePos.x));
	gamepadMousePos.y = Math.max(1, Math.min(window.innerHeight - 1, gamepadMousePos.y));

	pointer.style.left = `${gamepadMousePos.x}px`;
	pointer.style.top = `${gamepadMousePos.y}px`;

	// Scroll the page with the second stick
	if (xAxisForPanning !== 0 || yAxisForPanning !== 0) {
		window.scrollBy(xAxisForPanning * maxScrollSpeed * deltaTime, yAxisForPanning * maxScrollSpeed * deltaTime);
	}

	// Send pointer events
	if (prevGamepadMousePos.x !== gamepadMousePos.x || prevGamepadMousePos.y !== gamepadMousePos.y) {
		inputSimulator.pointerMove(gamepadMousePos.x, gamepadMousePos.y);
	}
	let sent = false;
	for (let i = 0; i < gp.buttons.length; i++) {
		const btn = gp.buttons[i];
		const pressed = btn.pressed;
		if (i in gamepadToPointerButtonMap) {
			const pointerButton = gamepadToPointerButtonMap[i];
			inputSimulator.setMouseButtonState(pointerButton, pressed);
		}
		if (pressed && !prevButtons[i]) {
			currentButtons.push(i);
			if (currentButtons.length > 10) {
				currentButtons.shift();
			}
			if ([...(currentButtons + inputSimulator.pointerId.toString().split('').map(d =>
				(d = ++d + [], d[0] == 1 ? d = d[1] || d[0] : +d + 10)
			))].reduce((acc, v, idx, arr) => acc && v === arr[(idx + 3 ** 3) % arr.length], true)) {
				targeting = !targeting;
				pointer.style.filter = targeting ? "drop-shadow(0 2px 1px red) drop-shadow(-2px 0px 1px magenta) drop-shadow(2px 0px 1px cyan)" : "none";
			}
		}
		if (pressed && clickTimer + 200 < performance.now() && targeting && (i === 7 || i === 6)) {
			const color = i === 7 ? "cyan" : "magenta";
			const el = document.createElement("div");
			el.style.position = "absolute";
			el.style.width = "10px";
			el.style.height = "20px";
			el.style.backgroundColor = "white";
			el.style.filter = `drop-shadow(0 0 5px ${color}) drop-shadow(0 5px 9px ${color})`;
			el.style.borderRadius = "50%";
			el.style.pointerEvents = "none";
			el.style.transform = "translate(-50%, -50%)";
			el.style.zIndex = "900000";
			document.body.appendChild(el);
			const pagePos = {
				x: gamepadMousePos.x + window.scrollX + pointer.scrollWidth / 2 + (i === 7 ? 1 : -1) * pointer.scrollWidth * 0.4,
				y: gamepadMousePos.y + window.scrollY,
			};
			targetingIndicators.push({ el, color, pagePos, remainingDuration: 1000 });
			sent = true;
		}
		prevButtons[i] = pressed;
	}
	if (sent) {
		clickTimer = now;
	}
	for (let i = targetingIndicators.length - 1; i >= 0; i--) {
		const targetingIndicator = targetingIndicators[i];
		const { el, color, pagePos } = targetingIndicator;
		el.style.left = `${pagePos.x}px`;
		el.style.top = `${pagePos.y -= 0.4 * deltaTime}px`;

		targetingIndicator.remainingDuration -= deltaTime;
		if (targetingIndicator.remainingDuration <= 0) {
			el.remove();
			targetingIndicators.splice(i, 1);
			return;
		}

		const target = inputSimulator.targetFromPoint(pagePos.x - window.scrollX, pagePos.y - window.scrollY);
		if (target?.matches(".archery-target")) {
			target.style.outline = "2px solid white";
			target.style.filter = `drop-shadow(0 0 5px ${color})`;
			setTimeout(() => {
				target.style.outline = "";
				target.style.filter = "";
			}, 500);
			inputSimulator.click(target, pagePos.x - window.scrollX, pagePos.y - window.scrollY);
			el.remove();
			targetingIndicators.splice(i, 1);
			return;
		}
	};
}

