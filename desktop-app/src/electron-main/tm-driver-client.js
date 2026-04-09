const net = require('net');
const readline = require('readline');

const DEFAULT_DRIVER_ADDRESS = '127.0.0.1:47047';

/** @type {import('net').Socket | null} */
let driverSocket = null;
/** @type {readline.Interface | null} */
let lineReader = null;
/** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
const pendingRequests = new Map();
let nextRequestId = 1;
let isShuttingDown = false;

function getDriverAddress() {
	return process.env.TM_DRIVER_ADDR || DEFAULT_DRIVER_ADDRESS;
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

function connectToDriver() {
	const driverAddress = getDriverAddress();
	const [host, portPart] = driverAddress.split(':');
	const port = Number(portPart);
	if (!host || !Number.isInteger(port) || port <= 0) {
		throw new Error(`Invalid TM_DRIVER_ADDR value: ${driverAddress}. Expected host:port`);
	}

	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port });
		let settled = false;
		const onError = (error) => {
			if (settled) {
				console.error(`[tm-driver] Socket error: ${error.message}`);
				return;
			}
			settled = true;
			reject(error);
		};
		socket.once('error', onError);
		socket.once('connect', () => {
			if (settled) {
				return;
			}
			settled = true;
			socket.off('error', onError);
			resolve(socket);
		});
	});
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

async function startTMDriver() {
	if (driverSocket) {
		return;
	}
	isShuttingDown = false;
	driverSocket = await withTimeout(
		connectToDriver(),
		3000,
		`Timed out connecting to tm-driver at ${getDriverAddress()}.`,
	);
	lineReader = readline.createInterface({ input: driverSocket });
	lineReader.on('line', handleDriverLine);
	driverSocket.on('error', (error) => {
		if (!isShuttingDown) {
			rejectAllPendingRequests(`tm-driver socket error: ${error.message}`);
		}
	});
	driverSocket.on('close', () => {
		if (lineReader) {
			lineReader.close();
			lineReader = null;
		}
		driverSocket = null;
		if (!isShuttingDown) {
			rejectAllPendingRequests('tm-driver connection closed unexpectedly');
		}
	});
	await withTimeout(
		callDriver('ping'),
		3000,
		`Timed out waiting for tm-driver ping response at ${getDriverAddress()}.`,
	);
}

async function stopTMDriver() {
	isShuttingDown = true;
	if (!driverSocket) {
		return;
	}
	const socket = driverSocket;
	driverSocket = null;
	if (lineReader) {
		lineReader.close();
		lineReader = null;
	}
	pendingRequests.clear(); // Drop silently instead of rejecting, to avoid errors during shutdown
	await new Promise((resolve) => {
		socket.once('close', () => resolve());
		socket.end();
		socket.destroy();
	});
}

function ensureDriverRunning() {
	if (!driverSocket || driverSocket.destroyed) {
		throw new Error(`tm-driver daemon is not connected at ${getDriverAddress()}.`);
	}
}

function callDriver(method, params = {}) {
	if (isShuttingDown) {
		return new Promise(() => { }); // Never resolves; callers suspend quietly during shutdown
	}
	ensureDriverRunning();
	const id = nextRequestId++;
	const payload = JSON.stringify({ id, method, params });
	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject });
		driverSocket.write(`${payload}\n`, (error) => {
			if (!error || isShuttingDown) {
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
