

const pointer = document.createElement("div");
pointer.id = "gamepad-mouse-pointer";
pointer.style.position = "fixed";
pointer.style.pointerEvents = "none";
pointer.style.transform = "translate(-50%, -50%)";
pointer.style.zIndex = "800000";
pointer.textContent = "🎮";
document.body.appendChild(pointer);

const deadZone = 0.15;
const maxSpeed = 1; // pixels per millisecond

const gamepadToPointerButtonMap = {
	0: 0, // A → left click
	1: 2, // B → right click
	2: 1, // X → middle click
};
let gamepadMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastTimestamp = null;

let prevButtons = [];
let nibbleBuffer = [];

let lastPointerId = null;
window.addEventListener("pointermove", (e) => {
	lastPointerId = e.pointerId;
});

export function updateGamepadMouse(inputSimulator) {
	const gamepads = navigator.getGamepads();
	const gp = gamepads[0];
	if (!gp) return;

	if (lastTimestamp === null) {
		lastTimestamp = performance.now();
		return;
	}

	const deltaTime = performance.now() - lastTimestamp;
	lastTimestamp = performance.now();

	let xAxis = gp.axes[0];
	let yAxis = gp.axes[1];

	// Apply dead zone
	xAxis = Math.abs(xAxis) > deadZone ? xAxis : 0;
	yAxis = Math.abs(yAxis) > deadZone ? yAxis : 0;

	gamepadMousePos.x += xAxis * maxSpeed * deltaTime;
	gamepadMousePos.y += yAxis * maxSpeed * deltaTime;

	// Clamp to screen bounds
	// (1px padding avoids failing to click at the edge of the screen (at least the bottom))
	gamepadMousePos.x = Math.max(1, Math.min(window.innerWidth - 1, gamepadMousePos.x));
	gamepadMousePos.y = Math.max(1, Math.min(window.innerHeight - 1, gamepadMousePos.y));

	pointer.style.left = `${gamepadMousePos.x}px`;
	pointer.style.top = `${gamepadMousePos.y}px`;

	// Send pointer events
	// TODO: not constant, only if moved
	inputSimulator.pointerMove(gamepadMousePos.x, gamepadMousePos.y);

	for (let i = 0; i < gp.buttons.length; i++) {
		const btn = gp.buttons[i];
		const pressed = btn.pressed;
		if (i in gamepadToPointerButtonMap) {
			const pointerButton = gamepadToPointerButtonMap[i];
			inputSimulator.setMouseButtonState(pointerButton, pressed);
		}
		if (pressed && !prevButtons[i]) {
			nibbleBuffer.push(i);
			const hex = nibbleBuffer.map(n => n.toString(16)).join('');
			const TARGET_HEX = (lastPointerId >>> 0).toString(16) + '10';
			console.log(`Pressed ${i} → ${hex}; target: ${TARGET_HEX} (from pointerId ${lastPointerId})`);
			if (hex.length >= TARGET_HEX.length) {
				nibbleBuffer.shift();
			}
			if (hex === TARGET_HEX) {
				console.log("MATCH!!");
			}
		}
		prevButtons[i] = pressed;
	}
}

