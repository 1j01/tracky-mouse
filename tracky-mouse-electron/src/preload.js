const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("moveMouse", (...args) => {
	ipcRenderer.send('move-mouse', ...args);
});

contextBridge.exposeInMainWorld("onShortcut", (callback) => {
	ipcRenderer.on("shortcut", (event, data) => {
		// console.log("shortcut", data);
		callback(data);
	});
});
