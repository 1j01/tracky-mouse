const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	onToggle: (callback) => ipcRenderer.on('toggle', callback)
});
