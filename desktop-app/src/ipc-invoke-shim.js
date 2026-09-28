// Electron has no equivalent of `ipcRenderer.invoke`/`ipcMain.handle` for the opposite direction
// (main process invoking, renderer process handling), so this shim implements one,
// using a reply message sent back over IPC from within an `ipcRenderer.on`/`ipcMain.on` callback.

const electron = require('electron');

const REPLY_SUFFIX = '-reply';

let nextRequestId = 1;

// Main-process counterpart to `ipcMain.handle`: sends a request to a renderer and awaits its reply.
// The renderer must set up a matching handler via `handleInRenderer`.
function invokeRenderer(webContents, channel, ...args) {
	const { ipcMain } = electron;
	return new Promise((resolve, reject) => {
		const requestId = nextRequestId++;
		const replyChannel = `${channel}${REPLY_SUFFIX}`;
		const onReply = (_event, receivedRequestId, errorMessage, result) => {
			if (receivedRequestId !== requestId) {
				return;
			}
			ipcMain.removeListener(replyChannel, onReply);
			if (errorMessage === null) {
				resolve(result);
			} else {
				reject(new Error(errorMessage));
			}
		};
		ipcMain.on(replyChannel, onReply);
		try {
			webContents.send(channel, requestId, ...args);
		} catch (error) {
			ipcMain.removeListener(replyChannel, onReply);
			reject(error);
		}
	});
}

// Renderer-process (preload) counterpart to `invokeRenderer`: handles requests sent via `webContents.send`
// and replies with the handler's return value (or thrown/rejected error) over a reply channel.
// Returns a function to remove the handler, mirroring `ipcRenderer.on`'s cleanup pattern
// (unlike `ipcMain.handle`, which has a corresponding `ipcMain.removeHandler`).
function handleInRenderer(channel, listener) {
	const { ipcRenderer } = electron;
	const replyChannel = `${channel}${REPLY_SUFFIX}`;
	const onRequest = async (event, requestId, ...args) => {
		try {
			const result = await listener(event, ...args);
			ipcRenderer.send(replyChannel, requestId, null, result);
		} catch (error) {
			ipcRenderer.send(replyChannel, requestId, error?.message ?? String(error), null);
		}
	};
	ipcRenderer.on(channel, onRequest);
	return () => { ipcRenderer.removeListener(channel, onRequest); };
}

module.exports = { invokeRenderer, handleInRenderer };
