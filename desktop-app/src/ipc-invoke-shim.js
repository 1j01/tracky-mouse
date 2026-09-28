// Electron has no equivalent of `ipcRenderer.invoke`/`ipcMain.handle` for the opposite direction
// (main process invoking, renderer process handling). This polyfills `webContents#invoke()` in the
// main process and `ipcRenderer.handle()` in the renderer, mirroring the shape and semantics of the
// built-in APIs, by sending a reply message back over IPC from within an `on` listener.
// Just requiring this module (for its side effects) installs the polyfill.

const electron = require('electron');

const REPLY_SUFFIX = '-reply';

let nextRequestId = 1;

function polyfillWebContentsInvoke(webContents) {
	if (webContents.invoke) {
		return;
	}
	const { ipcMain } = electron;
	webContents.invoke = function (channel, ...args) {
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
				this.send(channel, requestId, ...args);
			} catch (error) {
				ipcMain.removeListener(replyChannel, onReply);
				reject(error);
			}
		});
	};
}

if (electron.app) {
	// Main process. Every webContents instance needs the method added to it individually,
	// since Electron doesn't expose the WebContents class/prototype to patch just once.
	electron.app.on('web-contents-created', (_event, webContents) => polyfillWebContentsInvoke(webContents));
} else if (electron.ipcRenderer && !electron.ipcRenderer.handle) {
	// Renderer/preload process.
	const { ipcRenderer } = electron;
	ipcRenderer.handle = function (channel, listener) {
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
	};
}
