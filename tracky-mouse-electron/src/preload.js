const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("moveMouse", (x, y) => {
	ipcRenderer.send('move-mouse', x, y, performance.now());
});

contextBridge.exposeInMainWorld("onShortcut", (callback) => {
	ipcRenderer.on("shortcut", (event, data) => {
		// console.log("shortcut", data);
		callback(data);
	});
});
