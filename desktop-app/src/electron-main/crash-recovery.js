const { app, BrowserWindow } = require('electron');

function installCrashRecovery({
	getAppWindow,
	getScreenOverlayWindow,
}) {
	const defaultRecoveryDelayMs = 100;
	const maxRecoveryDelayMs = 5 * 1000;
	const recoveryDelayThresholdMs = 30 * 1000;
	let recoveryTimeout = null;
	let lastRecoveryAt = 0;
	/** @type {Map<BrowserWindow, { reasons: string[] }>} */
	const pendingRecovery = new Map();

	function recover() {
		for (const [browserWindow, { reasons }] of pendingRecovery.entries()) {
			reloadWindowSafely(browserWindow, reasons.join(', '));
		}
		pendingRecovery.clear();
		lastRecoveryAt = performance.now();
		recoveryTimeout = null;
	}

	function scheduleReload(browserWindow, reason) {
		const recoveryInfo = pendingRecovery.get(browserWindow) ?? { reasons: [] };
		recoveryInfo.reasons.push(reason);
		pendingRecovery.set(browserWindow, recoveryInfo);

		if (!recoveryTimeout) {
			const timeSinceLastRecovery = performance.now() - lastRecoveryAt;
			const recoveryDelayMs = timeSinceLastRecovery > recoveryDelayThresholdMs ? defaultRecoveryDelayMs : maxRecoveryDelayMs;
			recoveryTimeout = setTimeout(recover, recoveryDelayMs);
		}
	}

	function reloadWindowSafely(browserWindow, reason) {
		const label = browserWindow === getAppWindow() ? 'app window' : browserWindow === getScreenOverlayWindow() ? 'screen overlay window' : 'unknown window';
		if (!browserWindow || browserWindow.isDestroyed()) {
			console.error(`Renderer process for ${label} gone with reason ${reason}, but no owner window found to reload.`);
			return false;
		}
		try {
			console.error(`Recovering from ${reason}: reloading ${label}.`);
			browserWindow.webContents.reload();
			return true;
		} catch (error) {
			console.error(`Failed to reload ${label} after ${reason}:`, error);
			return false;
		}
	}

	function scheduleReloadingBothWindows(reason) {
		scheduleReload(getAppWindow(), reason);
		scheduleReload(getScreenOverlayWindow(), reason);
	}

	app.on('render-process-gone', (_event, webContents, details) => {
		const reason = details?.reason || 'unknown';
		console.error('Renderer process gone:', {
			reason,
			exitCode: details?.exitCode,
			name: details?.name,
		});

		if (reason === 'clean-exit') {
			return;
		}

		const ownerWindow = BrowserWindow.fromWebContents(webContents);
		scheduleReload(ownerWindow, `renderer ${reason}`);
	});

	app.on('child-process-gone', (_event, details) => {
		const reason = details?.reason || 'unknown';
		const type = details?.type || 'unknown';
		console.error('Child process gone:', {
			type,
			reason,
			exitCode: details?.exitCode,
			name: details?.name,
			serviceName: details?.serviceName,
		});

		if (reason === 'clean-exit') {
			return;
		}

		if (type === 'GPU' || type === 'Utility') {
			scheduleReloadingBothWindows(`${type.toLowerCase()} process ${reason}`);
		}
	});
}

module.exports = {
	installCrashRecovery,
};
