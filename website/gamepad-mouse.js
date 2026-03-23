

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

let gamepadMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastTimestamp = null;

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
	gamepadMousePos.x = Math.max(0, Math.min(window.innerWidth, gamepadMousePos.x));
	gamepadMousePos.y = Math.max(0, Math.min(window.innerHeight, gamepadMousePos.y));

	pointer.style.left = `${gamepadMousePos.x}px`;
	pointer.style.top = `${gamepadMousePos.y}px`;

	// send pointer events using inputSimulator
	window._temporaryPointerIdOverride = GAMEPAD_POINTER_ID;
	inputSimulator.pointerMove(gamepadMousePos.x, gamepadMousePos.y);
	delete window._temporaryPointerIdOverride;
}


const KONAMI_CODE_NIBBLES = GAMEPAD_POINTER_ID;


