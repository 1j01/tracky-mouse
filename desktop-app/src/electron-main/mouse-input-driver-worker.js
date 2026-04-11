const { parentPort } = require('worker_threads');
const serenadeDriver = require('serenade-driver');

const supportedMethods = new Set([
	'setMouseLocation',
	'getMouseLocation',
	'click',
	'mouseDown',
	'mouseUp',
]);

if (!parentPort) {
	throw new Error('mouse-input-driver-worker must be run as a Worker thread');
}

parentPort.on('message', async (message) => {
	const { id, method, args } = message || {};
	if (typeof id !== 'number') {
		return;
	}
	if (!supportedMethods.has(method) || typeof serenadeDriver[method] !== 'function') {
		parentPort.postMessage({ id, ok: false, error: `Unsupported driver method: ${method}` });
		return;
	}
	try {
		const result = await serenadeDriver[method](...(Array.isArray(args) ? args : []));
		parentPort.postMessage({ id, ok: true, result });
	} catch (error) {
		const errorMessage = error && error.message ? error.message : String(error);
		parentPort.postMessage({ id, ok: false, error: errorMessage });
	}
});
