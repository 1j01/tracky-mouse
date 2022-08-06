const { app, globalShortcut, dialog, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setMouseLocation, getMouseLocation, click } = require('serenade-driver');
const windowStateKeeper = require('electron-window-state');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
	app.quit();
}

// Allow recovering from WebGL crash unlimited times.
// (To test the recovery, I've been using Ctrl+Alt+F1 and Ctrl+Alt+F2 in Ubuntu.
// Note, if Ctrl + Alt + F2 doesn't get you back, try Ctrl+Alt+F7.)
app.commandLine.appendSwitch("--disable-gpu-process-crash-limit");


const trackyMouseFolder = app.isPackaged ? `${app.getAppPath()}/copied/` : `${__dirname}/../../`;

let mainWindow;
let screenOverlayWindow;

const createWindow = () => {
	const mainWindowState = windowStateKeeper({
		defaultWidth: 750,
		defaultHeight: 700,
	});

	// Create the browser window.
	mainWindow = new BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		webPreferences: {
			preload: path.join(app.getAppPath(), 'src/preload-main.js'),
			// Disable throttling of animations and timers so the mouse control can still work when minimized.
			backgroundThrottling: false,
		},
		// icon: `${trackyMouseFolder}/images/tracky-mouse-logo-16.png`,
		icon: `${trackyMouseFolder}/images/tracky-mouse-logo-512.png`,
	});

	// and load the html page of the app.
	mainWindow.loadFile(`src/electron-app.html`);

	// Toggle the DevTools with F12
	mainWindow.webContents.on("before-input-event", (e, input) => {
		if (input.type === "keyDown" && input.key === "F12") {
			mainWindow.webContents.toggleDevTools();

			mainWindow.webContents.on('devtools-opened', async () => {
				// Can't use mainWindow.webContents.devToolsWebContents.on("before-input-event") - it just doesn't intercept any events.
				await mainWindow.webContents.devToolsWebContents.executeJavaScript(`
					new Promise((resolve)=> {
						addEventListener("keydown", (event) => {
							if (event.key === "F12") {
								resolve();
							}
						}, { once: true });
					})
				`);
				mainWindow.webContents.toggleDevTools();
			});
		}
	});

	// Restore window state, and listen for window state changes.
	mainWindowState.manage(mainWindow);

	// Clean up overlay when the app window is closed.
	mainWindow.on('close', () => {
		screenOverlayWindow?.close();
	});

	// Expose functionality to the renderer processes.

	// Allow controlling the mouse, but pause if the mouse is moved normally.
	const thresholdToRegainControl = 10; // in pixels
	const regainControlForTime = 2000; // in milliseconds
	let regainControlTimeout = null; // also used to check if we're pausing temporarily
	let enabled = true; // for starting/stopping until the user requests otherwise
	let lastPos = { x: undefined, y: undefined };
	const updateDwellClicking = () => {
		screenOverlayWindow.webContents.send('change-dwell-clicking', enabled && regainControlTimeout === null);
	};
	ipcMain.on('move-mouse', async (event, x, y, time) => {
		const curPos = await getMouseLocation();
		const distanceMoved = lastPos.x !== undefined ? Math.hypot(curPos.x - lastPos.x, curPos.y - lastPos.y) : 0;
		if (distanceMoved > thresholdToRegainControl) {
			// console.log("distanceMoved", distanceMoved, ">", thresholdToRegainControl, { curPos, lastPos, x, y });
			clearTimeout(regainControlTimeout);
			regainControlTimeout = setTimeout(() => {
				regainControlTimeout = null; // used to check if we're pausing
				// console.log("Mouse not moved for", regainControlForTime, "ms; resuming.");
				updateDwellClicking();
			}, regainControlForTime);
			updateDwellClicking();
			lastPos = {x: curPos.x, y: curPos.y};
		} else if (regainControlTimeout === null && enabled) { // (shouldn't really get this event if enabled is false)
			lastPos = { x, y };
			// lastPos = {x: curPos.x, y: curPos.y};
			// Note: no await here, not for a particular reason.
			setMouseLocation(x, y);
		}
		// const latency = performance.now() - time;
		// console.log(`move-mouse: (${x}, ${y}), latency: ${latency}, distanceMoved: ${distanceMoved}, curPos: (${curPos.x}, ${curPos.y}), lastPos: (${lastPos.x}, ${lastPos.y})`);

		screenOverlayWindow.webContents.send('move-mouse', x, y, time);
	});

	ipcMain.on('notify-toggle-state', (event, nowEnabled) => {
		enabled = nowEnabled;
		updateDwellClicking();

		// Start immediately if enabled.
		clearTimeout(regainControlTimeout);
		regainControlTimeout = null;
		lastPos = { x: undefined, y: undefined };
	});

	ipcMain.on('click', async (event, x, y, time) => {
		if (regainControlTimeout || !enabled) {
			return;
		}

		// Translate coords in case of debug (doesn't matter when it's fullscreen).
		x += screenOverlayWindow.getContentBounds().x;
		y += screenOverlayWindow.getContentBounds().y;

		lastPos = { x, y }; // probably not enough to work reliably, trying to prevent it from pausing after a dwell click.
		await setMouseLocation(x, y);
		await click();

		// const latency = performance.now() - time;
		// console.log(`click: ${x}, ${y}, latency: ${latency}`);
	});

	// Set up the screen overlay window.
	// We cannot require the screen module until the app is ready.
	const { screen } = require('electron');
	const primaryDisplay = screen.getPrimaryDisplay();
	screenOverlayWindow = new BrowserWindow({
		x: primaryDisplay.bounds.x,
		y: primaryDisplay.bounds.y,
		width: primaryDisplay.bounds.width,
		height: primaryDisplay.bounds.height,
		frame: false,
		transparent: true,
		backgroundColor: '#00000000',
		hasShadow: false,
		roundedCorners: false,
		alwaysOnTop: true,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: false,
		fullscreenable: false, // may want this...
		// fullscreen: true,
		focusable: false,
		skipTaskbar: true,
		accessibleTitle: 'Tracky Mouse Screen Overlay',
		webPreferences: {
			preload: path.join(app.getAppPath(), 'src/preload-screen-overlay.js'),
		},
	});
	screenOverlayWindow.setIgnoreMouseEvents(true);
	screenOverlayWindow.setAlwaysOnTop(true, 'screen-saver');

	screenOverlayWindow.loadFile(`src/electron-screen-overlay.html`);
	screenOverlayWindow.on('closed', () => {
		screenOverlayWindow = null;
	});

	// screenOverlayWindow.webContents.openDevTools({ mode: 'detach' });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
	createWindow();

	const success = globalShortcut.register('F9', () => {
		// console.log('Toggle tracking');
		mainWindow.webContents.send("shortcut", "toggle-tracking");
	});
	if (!success) {
		dialog.showErrorBox("Failed to register shortcut", "Failed to register global shortcut F9. You'll need to pause from within the app.");
	}
});

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
	app.quit();
}

app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
