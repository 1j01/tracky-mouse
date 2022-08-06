const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	onToggle: (callback) => ipcRenderer.on('toggle', callback),
	onMouseMove: (callback) => ipcRenderer.on('mouse-move', callback),

	// This is pretty weird but I'm giving the overlay window control over clicking,
	// whereas the main window has control over moving the mouse.
	// The main window has the head tracker, which moves the mouse,
	// and the overlay window renders the dwell clicking (rendering, and, in this case, clicking).
	// It's quite the hacky architecture.

	mouseClick: (x, y) => ipcRenderer.send('click', x, y, performance.now()),
});
