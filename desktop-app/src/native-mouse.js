const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

let child = null;
let nextId = 1;
const pending = new Map();
let fatalError = null;

function getBinaryPath() {
	const exe = process.platform === "win32" ? "tm-native.exe" : "tm-native";
	// 1. Explicit override for testing or non-standard layouts
	if (process.env.TM_NATIVE_PATH) {
		return process.env.TM_NATIVE_PATH;
	}
	// 2. Development: run from source tree (desktop-app/tm-native)
	const devPath = path.join(__dirname, "..", "tm-native", exe);
	if (fs.existsSync(devPath)) {
		return devPath;
	}
	// 3. Packaged: Electron Forge copies tm-native into resources as an extraResource
	// In development, process.resourcesPath points into electron/dist/resources and
	// will not contain tm-native, so treat missing devPath as "not available".
	if (!process.resourcesPath || process.resourcesPath.includes(path.join("node_modules", "electron", "dist", "resources"))) {
		return null;
	}
	return path.join(process.resourcesPath, exe);
}

function ensureChild() {
	if (fatalError) {
		throw fatalError;
	}
	if (child && !child.killed) {
		return;
	}
	const binPath = getBinaryPath();
	if (!binPath || !fs.existsSync(binPath)) {
		fatalError = new Error("tm-native binary not found; mouse control helper is unavailable.");
		throw fatalError;
	}
	try {
		child = spawn(binPath, [], { stdio: ["pipe", "pipe", "inherit"] });
	} catch (error) {
		fatalError = error;
		child = null;
		throw error;
	}

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

	child.on("error", (error) => {
		if (!fatalError) {
			fatalError = error;
		}
		for (const { reject } of pending.values()) {
			reject(error);
		}
		pending.clear();
		child = null;
	});

	child.on("exit", (code, signal) => {
		const err = new Error(
			`tm-native process exited with ${signal || code}`,
		);
		if (!fatalError) {
			fatalError = err;
		}
		for (const { reject } of pending.values()) {
			reject(err);
		}
		pending.clear();
		child = null;
	});
}

function sendCommand(cmd, payload) {
	return new Promise((resolve, reject) => {
		try {
			ensureChild();
		} catch (error) {
			reject(error);
			return;
		}
		if (!child || !child.stdin || child.stdin.destroyed) {
			reject(fatalError || new Error("tm-native process not available"));
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

async function ensureCursorVisible() {
	await sendCommand("ensureCursorVisible", {});
}

module.exports = {
	setMouseLocation,
	getMouseLocation,
	click,
	mouseDown,
	mouseUp,
	ensureCursorVisible,
};
