const { moveMouse } = require('robotjs');
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("moveMouse", (...args) => moveMouse(...args));

ipcRenderer.on("shortcut-register-result", (event, data) => {
	// console.log("shortcut-register-result", data);
	contextBridge.exposeInMainWorld("shortcutRegisterSuccess", data);
});

contextBridge.exposeInMainWorld("onShortcut", (callback) => {
	ipcRenderer.on("shortcut", (event, data) => {
		// console.log("shortcut", data);
		callback(data);
	});
});
