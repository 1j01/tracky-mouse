const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

let child = null;
let nextId = 1;
const pending = new Map();

function getBinaryPath() {
	const exe = process.platform === "win32" ? "tm-native.exe" : "tm-native";
	// 1. Explicit override for testing or non-standard layouts
	if (process.env.TM_NATIVE_PATH) {
		return process.env.TM_NATIVE_PATH;
	}
	// 2. Development: run from source tree (desktop-app/tm-native)
	const devPath = path.join(__dirname, "..", "tm-native", exe);
	// 3. Packaged: Electron Forge copies tm-native into resources as an extraResource
	const resourcesPath = process.resourcesPath || path.join(__dirname, "..", "..", "..");
	const prodPath = path.join(resourcesPath, exe);
	return process.env.NODE_ENV === "development" ? devPath : prodPath;
}

function ensureChild() {
	if (child && !child.killed) {
		return;
	}
	const binPath = getBinaryPath();
	child = spawn(binPath, [], { stdio: ["pipe", "pipe", "inherit"] });

	const rl = readline.createInterface({ input: child.stdout });
	rl.on("line", (line) => {
		let msg;
		try {
			msg = JSON.parse(line);
		} catch (_error) {
			return;
		}
		const { id, ok, error, x, y } = msg;
		const entry = pending.get(id);
		if (!entry) {
			return;
		}
		pending.delete(id);
		if (!ok) {
			entry.reject(new Error(error || "tm-native error"));
		} else {
			entry.resolve({ x, y });
		}
	});

	child.on("exit", (code, signal) => {
		const err = new Error(
			`tm-native process exited with ${signal || code}`,
		);
		for (const { reject } of pending.values()) {
			reject(err);
		}
		pending.clear();
		child = null;
	});
}

function sendCommand(cmd, payload) {
	return new Promise((resolve, reject) => {
		ensureChild();
		if (!child || !child.stdin) {
			reject(new Error("tm-native process not available"));
			return;
		}
		const id = nextId++;
		pending.set(id, { resolve, reject });
		const msg = JSON.stringify({ id, cmd, ...payload }) + "\n";
		child.stdin.write(msg, (error) => {
			if (error) {
				pending.delete(id);
				reject(error);
			}
		});
	});
}

async function setMouseLocation(x, y) {
	await sendCommand("setMouseLocation", { x, y });
}

async function getMouseLocation() {
	const { x, y } = await sendCommand("getMouseLocation", {});
	return { x, y };
}

async function click(button) {
	await sendCommand("click", { button });
}

async function mouseDown(button) {
	await sendCommand("mouseDown", { button });
}

async function mouseUp(button) {
	await sendCommand("mouseUp", { button });
}

module.exports = {
	setMouseLocation,
	getMouseLocation,
	click,
	mouseDown,
	mouseUp,
};
