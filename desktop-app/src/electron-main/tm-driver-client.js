const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

/** @type {import('electron').App | undefined} */
let electronApp;
/** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
let driverProcess = null;
/** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
const pendingRequests = new Map();
let nextRequestId = 1;
let hasProcessExitHook = false;

function getDriverExecutableName() {
	return process.platform === 'win32' ? 'tracky-mouse-driver.exe' : 'tracky-mouse-driver';
}

function getPackagedDriverPath() {
	return path.join(process.resourcesPath, 'tm-driver', 'bin', getDriverExecutableName());
}

function getDevelopmentDriverPath(app) {
	return path.join(app.getAppPath(), 'tm-driver', 'bin', getDriverExecutableName());
}

function getGoSourceDir(app) {
	return path.join(app.getAppPath(), 'tm-driver');
}

function rejectAllPendingRequests(message) {
	for (const { reject } of pendingRequests.values()) {
		reject(new Error(message));
	}
	pendingRequests.clear();
}

function handleDriverLine(line) {
	let response;
	try {
		response = JSON.parse(line);
	} catch (error) {
		console.error('[tm-driver] Failed to parse JSON response:', line, error);
		return;
	}
	if (typeof response.id !== 'number') {
		console.error('[tm-driver] Missing numeric response id:', response);
		return;
	}
	const pending = pendingRequests.get(response.id);
	if (!pending) {
		return;
	}
	pendingRequests.delete(response.id);
	if (response.error) {
		pending.reject(new Error(response.error));
		return;
	}
	pending.resolve(response.result);
}

function spawnDriverProcess(command, args, options = {}) {
	const proc = spawn(command, args, {
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
		...options,
	});

	const lineReader = readline.createInterface({ input: proc.stdout });
	lineReader.on('line', handleDriverLine);
	proc.stderr.on('data', (chunk) => {
		console.error(`[tm-driver] ${chunk.toString().trimEnd()}`);
	});
	proc.on('exit', (code, signal) => {
		driverProcess = null;
		rejectAllPendingRequests(`tm-driver exited unexpectedly (code=${code}, signal=${signal ?? 'none'})`);
	});
	proc.on('error', (error) => {
		driverProcess = null;
		rejectAllPendingRequests(`tm-driver failed to start: ${error.message}`);
	});

	return proc;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
	let timeoutId;
	const timeoutPromise = new Promise((_resolve, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(timeoutMessage));
		}, timeoutMs);
	});
	return Promise.race([promise, timeoutPromise]).finally(() => {
		clearTimeout(timeoutId);
	});
}

async function startTMDriver({ app }) {
	if (driverProcess) {
		return;
	}
	electronApp = app;
	const executableName = getDriverExecutableName();
	const packagedPath = getPackagedDriverPath();
	const developmentPath = getDevelopmentDriverPath(app);
	let command;
	let args;
	let options = {};
	if (app.isPackaged) {
		command = packagedPath;
		args = [];
	} else if (fs.existsSync(developmentPath)) {
		command = developmentPath;
		args = [];
	} else {
		command = 'go';
		args = ['run', '.'];
		options = { cwd: getGoSourceDir(app) };
	}
	driverProcess = spawnDriverProcess(command, args, options);
	if (!driverProcess) {
		throw new Error(`Failed to start tm-driver (${executableName}).`);
	}
	await withTimeout(
		callDriver('ping'),
		3000,
		`Timed out waiting for tm-driver startup (${executableName}).`,
	);
	if (!hasProcessExitHook) {
		hasProcessExitHook = true;
		process.once('exit', () => {
			if (driverProcess) {
				driverProcess.kill();
			}
		});
	}
}

async function stopTMDriver() {
	if (!driverProcess) {
		return;
	}
	const proc = driverProcess;
	driverProcess = null;
	rejectAllPendingRequests('tm-driver stopped');
	await new Promise((resolve) => {
		proc.once('exit', () => resolve());
		proc.kill();
	});
}

function ensureDriverRunning() {
	if (!driverProcess) {
		const location = electronApp?.isPackaged ? getPackagedDriverPath() : getDevelopmentDriverPath(electronApp);
		throw new Error(`tm-driver process is not running. Expected binary at: ${location}`);
	}
}

function callDriver(method, params = {}) {
	ensureDriverRunning();
	const id = nextRequestId++;
	const payload = JSON.stringify({ id, method, params });
	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject });
		driverProcess.stdin.write(`${payload}\n`, (error) => {
			if (!error) {
				return;
			}
			pendingRequests.delete(id);
			reject(error);
		});
	});
}

async function setMouseLocation(x, y) {
	await callDriver('setMouseLocation', { x, y });
}

async function getMouseLocation() {
	const result = await callDriver('getMouseLocation');
	if (!result || typeof result.x !== 'number' || typeof result.y !== 'number') {
		throw new Error('tm-driver returned invalid mouse position data');
	}
	return result;
}

async function click(button) {
	await callDriver('click', { button });
}

async function mouseDown(button) {
	await callDriver('mouseDown', { button });
}

async function mouseUp(button) {
	await callDriver('mouseUp', { button });
}

module.exports = {
	startTMDriver,
	stopTMDriver,
	setMouseLocation,
	getMouseLocation,
	click,
	mouseDown,
	mouseUp,
};
