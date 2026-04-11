const path = require('path');
const { Worker } = require('worker_threads');

let worker = null;
let nextRequestId = 1;
/** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
const pendingRequests = new Map();

function rejectAllPendingRequests(error) {
	for (const { reject } of pendingRequests.values()) {
		reject(error);
	}
	pendingRequests.clear();
}

function ensureWorker() {
	if (worker) {
		return worker;
	}

	const workerPath = path.join(__dirname, 'mouse-input-driver-worker.js');
	worker = new Worker(workerPath);

	worker.on('message', (message) => {
		const { id, ok, result, error } = message || {};
		if (typeof id !== 'number') {
			return;
		}
		const pending = pendingRequests.get(id);
		if (!pending) {
			return;
		}
		pendingRequests.delete(id);
		if (!ok) {
			pending.reject(new Error(error || 'mouse input driver worker error'));
			return;
		}
		pending.resolve(result);
	});

	worker.on('error', (error) => {
		rejectAllPendingRequests(error);
		worker = null;
	});

	worker.on('exit', (code) => {
		if (code !== 0) {
			rejectAllPendingRequests(new Error(`mouse input driver worker exited with code ${code}`));
		}
		worker = null;
	});

	return worker;
}

function callWorker(method, args = []) {
	return new Promise((resolve, reject) => {
		const activeWorker = ensureWorker();
		const id = nextRequestId++;
		pendingRequests.set(id, { resolve, reject });
		activeWorker.postMessage({ id, method, args });
	});
}

async function setMouseLocation(x, y) {
	await callWorker('setMouseLocation', [x, y]);
}

async function getMouseLocation() {
	const result = await callWorker('getMouseLocation');
	if (!result || typeof result.x !== 'number' || typeof result.y !== 'number') {
		throw new Error('Mouse input driver returned invalid mouse position data');
	}
	return result;
}

async function click(button) {
	await callWorker('click', [button]);
}

async function mouseDown(button) {
	await callWorker('mouseDown', [button]);
}

async function mouseUp(button) {
	await callWorker('mouseUp', [button]);
}

module.exports = {
	setMouseLocation,
	getMouseLocation,
	click,
	mouseDown,
	mouseUp,
};
