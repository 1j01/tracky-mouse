// This script is injected into the MAIN APP WINDOW, before other scripts,
// with privileged access to the electron API, which it should expose in a limited way.
// That said, mouse control is pretty powerful, so it's important to keep it secure.

// TODO: enable error reporting in renderer processes
// `require("@sentry/electron/renderer")` fails due to sandboxing...
// const Sentry = require("@sentry/electron/renderer");
// Sentry.init();

const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld("electronAPI", {
	moveMouse: (x, y) => {
		ipcRenderer.send('moveMouse', x, y, performance.now());
	},

	setMouseButtonState: (button, down) => {
		return ipcRenderer.invoke('setMouseButtonState', button, down);
	},

	onShortcut: (callback) => {
		const listener = (_event, data) => { callback(data); };
		ipcRenderer.on("shortcut", listener);
		return () => { ipcRenderer.removeListener("shortcut", listener); };
	},

	notifyToggleState: (nowEnabled) => {
		ipcRenderer.send('notifyToggleState', nowEnabled);
	},

	updateInputFeedback: (data) => {
		ipcRenderer.send('updateInputFeedback', data);
	},

	setOptions: (optionsPatch) => {
		ipcRenderer.send('setOptions', optionsPatch);
	},

	getOptions: () => {
		return ipcRenderer.invoke('getOptions');
	},

	// isPackaged: app.isPackaged, // can't require electron's app module here
	// isPackaged: !!process.defaultApp, // nope, doesn't exist
	getIsPackaged: () => ipcRenderer.invoke('getIsPackaged'),

	getPlatform: () => process.platform,

	getCustomMenuBarModel: () => ipcRenderer.invoke('getCustomMenuBarModel'),

	invokeMenuItem: (menuItemId) => ipcRenderer.invoke('invokeMenuItem', menuItemId),

	onCustomMenuBarModelUpdated: (callback) => {
		const listener = (_event, model) => { callback(model); };
		ipcRenderer.on('customMenuBarModelUpdated', listener);
		return () => { ipcRenderer.removeListener('customMenuBarModelUpdated', listener); };
	},

	openCameraSettings: (deviceId) => {
		return ipcRenderer.invoke('openCameraSettings', deviceId);
	},
});
