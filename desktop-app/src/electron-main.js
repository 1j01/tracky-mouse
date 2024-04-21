const { app, globalShortcut, dialog, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	app.quit(); // does not exit immediately!
	return; // important!
}

// Don't require any third-party modules until after squirrel events are handled.
// If anything goes wrong, it's very bad for it to go wrong during installation and uninstallation!
const windowStateKeeper = require('electron-window-state');
const { setMouseLocation, getMouseLocation, click } = require('serenade-driver');

// Allow recovering from WebGL crash unlimited times.
// (To test the recovery, I've been using Ctrl+Alt+F1 and Ctrl+Alt+F2 in Ubuntu.
// Note, if Ctrl + Alt + F2 doesn't get you back, try Ctrl+Alt+F7.)
app.commandLine.appendSwitch("--disable-gpu-process-crash-limit");


/** @type {BrowserWindow} */
let appWindow;
/** @type {BrowserWindow} */
let screenOverlayWindow;

const createWindow = () => {
	const appWindowState = windowStateKeeper({
		defaultWidth: 750,
		defaultHeight: 700,
	});

	// Create the browser window.
	appWindow = new BrowserWindow({
		x: appWindowState.x,
		y: appWindowState.y,
		width: appWindowState.width,
		height: appWindowState.height,
		webPreferences: {
			preload: path.join(app.getAppPath(), 'src/preload-app-window.js'),
			// Disable throttling of animations and timers so the mouse control can still work when minimized.
			backgroundThrottling: false,
		},
		icon: `${__dirname}/../images/tracky-mouse-logo-512.png`,
	});

	// and load the html page of the app.
	appWindow.loadFile(`src/electron-app.html`);

	// Toggle the DevTools with F12
	appWindow.webContents.on("before-input-event", (e, input) => {
		if (input.type === "keyDown" && input.key === "F12") {
			appWindow.webContents.toggleDevTools();

			appWindow.webContents.on('devtools-opened', async () => {
				// Can't use appWindow.webContents.devToolsWebContents.on("before-input-event") - it just doesn't intercept any events.
				await appWindow.webContents.devToolsWebContents.executeJavaScript(`
					new Promise((resolve)=> {
						addEventListener("keydown", (event) => {
							if (event.key === "F12") {
								resolve();
							}
						}, { once: true });
					})
				`);
				appWindow.webContents.toggleDevTools();
			});
		}
	});

	// Restore window state, and listen for window state changes.
	appWindowState.manage(appWindow);

	// Clean up overlay when the app window is closed.
	appWindow.on('closed', () => {
		appWindow = null; // not needed if calling app.exit(), which exits immediately, but useful if calling other methods to quit
		// screenOverlayWindow?.close(); // doesn't work because screenOverlayWindow.closable is false
		// app.quit(); // doesn't work either, because screenOverlayWindow.closable is false
		app.exit(); // doesn't call beforeunload and unload listeners, or before-quit or will-quit
		// Note: if re-assessing this, for macOS, make sure to handle the global shortcut, when the window doesn't exist.
	});

	// Expose functionality to the renderer processes.

	// Allow controlling the mouse, but pause if the mouse is moved normally.
	const thresholdToRegainControl = 10; // in pixels
	const regainControlForTime = 2000; // in milliseconds
	let regainControlTimeout = null; // also used to check if we're pausing temporarily
	let enabled = true; // for starting/stopping until the user requests otherwise
	let swapMouseButtons = false; // for left-handed users on Windows, where serenade-driver is affected by the system setting
	let lastPos = { x: undefined, y: undefined };
	const updateDwellClicking = () => {
		screenOverlayWindow.webContents.send('change-dwell-clicking', enabled && regainControlTimeout === null);
	};
	ipcMain.on('move-mouse', async (event, x, y, time) => {
		const curPos = await getMouseLocation();
		// TODO: fix false positives of mouse movement detection.
		// - Maybe await the setMouseLocation and disable the mouse movement detection until it's done?
		//   Might not work if outstanding promises overlap. If so, there wouldn't be a period of time
		//   where the mouse movement detection is enabled, or it would be enabled even though a later request
		//   to move the mouse is already in progress, making it sporadic.
		// - Maybe store a queue of mouse movement, and compare the current mouse position
		//   against each point in the queue. I think that should be robust.
		//   How long should the queue be? Points could be removed when setMouseLocation resolves,
		//   if and only if it's guaranteed that getMouseLocation will return the new position at that point.
		//   However, a simple time or count limit should be fine.
		// - Might want to use a history of mouse movement, rather than just the latest position,
		//   in order to require more travel without requiring significantly higher speed.
		//   This would have to be a separate queue of getMouseLocation results,
		//   rather than the queue of setMouseLocation requests.
		//   Should consider framerate independence, and ideally define the threshold in terms of travel within a period of time.
		//   (Should distance be measured in pixels, inches/cm, or screen percentage? probably pixels, to keep it simple.)
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
			lastPos = { x: curPos.x, y: curPos.y };
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

	ipcMain.on('set-options', (event, newOptions) => {
		if ("swapMouseButtons" in newOptions) {
			swapMouseButtons = newOptions.swapMouseButtons;
		}
	});

	ipcMain.on('click', async (event, x, y, time) => {
		if (regainControlTimeout || !enabled) {
			return;
		}

		// Failsafe: don't click if the window(s) are closed.
		// This helps with debugging the closing/quitting behavior.
		// It would also help to have a heartbeat to avoid clicking while paused in the debugger in other scenarios,
		// and avoid the dwell clicking indicator from repeatedly showing while there's no connectivity between the processes.
		if (
			(!screenOverlayWindow || screenOverlayWindow.isDestroyed()) ||
			(!appWindow || appWindow.isDestroyed())
		) {
			return;
		}

		// Translate coords in case of debug (doesn't matter when it's fullscreen).
		x += screenOverlayWindow.getContentBounds().x;
		y += screenOverlayWindow.getContentBounds().y;

		// Trying to prevent a false positive of mouse hardware mouse movement detection,
		// so that it doesn't pause after a dwell click. This might not be enough to work reliably.
		lastPos = { x, y };

		await setMouseLocation(x, y);
		await click(swapMouseButtons ? "right" : "left");

		// const latency = performance.now() - time;
		// console.log(`click: ${x}, ${y}, latency: ${latency}`);
	});

	// Set up the screen overlay window.
	// We cannot require the screen module until the app is ready.
	const { screen } = require('electron');
	const primaryDisplay = screen.getPrimaryDisplay();
	screenOverlayWindow = new BrowserWindow({
		fullscreen: true, // needed on Windows 11, since it seems to constrain the size to the work area otherwise
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
	screenOverlayWindow.on('close', (event) => {
		// If Windows Explorer is restarted while the app is running,
		// the Screen Overlay Window can appear in the taskbar, and become closable.
		// Various window attributes are forgotten, so we need to reset them.
		// A more proactive approach of restoring skipTaskbar when Windows Explorer is restarted would be better.
		// See: https://github.com/1j01/tracky-mouse/issues/47
		// And: https://github.com/electron/electron/issues/29526
		event.preventDefault();
		screenOverlayWindow.setSkipTaskbar(true);
		screenOverlayWindow.setClosable(false);
		screenOverlayWindow.setFullScreen(true);
		screenOverlayWindow.setIgnoreMouseEvents(true);
		// "screen-saver" is the highest level; it should show above the taskbar.
		screenOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
		// The window isn't showing on top of the taskbar without this.
		screenOverlayWindow.hide();
		screenOverlayWindow.show();
	});
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
		appWindow.webContents.send("shortcut", "toggle-tracking");
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
	if (appWindow) {
		if (appWindow.isMinimized()) {
			appWindow.restore();
		}

		appWindow.show();
	}
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
// NOTE: currently exiting with app.exit()
// If re-assessing this, for macOS, make sure to handle the global shortcut, when the window doesn't exist.
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
