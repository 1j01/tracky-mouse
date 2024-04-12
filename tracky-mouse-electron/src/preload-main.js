// This script is injected into the MAIN APP WINDOW, before other scripts,
// with privileged access to the electron API, which it should expose in a limited way.
// That said, mouse control is pretty powerful, so it's important to keep it secure.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld("moveMouse", (x, y) => {
	ipcRenderer.send('move-mouse', x, y, performance.now());
});

contextBridge.exposeInMainWorld("onShortcut", (callback) => {
	ipcRenderer.on("shortcut", (event, data) => {
		// console.log("shortcut", data);
		callback(data);
	});
});

contextBridge.exposeInMainWorld("notifyToggleState", (callback) => {
	ipcRenderer.send('notify-toggle-state', callback);
});

// There are already too many electron-injected globals, so I'm making this one a little bit generic for reuse.
// Still, other ones should be consolidated into a single object. These globals aren't part of the API, are they?
// I see I've already done this for the preload-screen-overlay.js (exposing `electronAPI`), so why not here too?
contextBridge.exposeInMainWorld("setOptions", (callback) => {
	ipcRenderer.send('set-options', callback);
});

contextBridge.exposeInMainWorld("IS_ELECTRON_APP", true);
