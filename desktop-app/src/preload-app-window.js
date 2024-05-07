// This script is injected into the MAIN APP WINDOW, before other scripts,
// with privileged access to the electron API, which it should expose in a limited way.
// That said, mouse control is pretty powerful, so it's important to keep it secure.

const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld("electronAPI", {
	moveMouse: (x, y) => {
		ipcRenderer.send('move-mouse', x, y, performance.now());
	},

	onShortcut: (callback) => {
		ipcRenderer.on("shortcut", (event, data) => {
			// console.log("shortcut", data);
			callback(data);
		});
	},

	notifyToggleState: (nowEnabled) => {
		ipcRenderer.send('notify-toggle-state', nowEnabled);
	},

	setOptions: (optionsPatch) => {
		ipcRenderer.send('set-options', optionsPatch);
	},

	getOptions: () => {
		return ipcRenderer.invoke('get-options');
	},
});
