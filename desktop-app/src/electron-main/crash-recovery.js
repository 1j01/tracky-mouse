function installCrashRecovery({
	app,
	BrowserWindow,
	getAppWindow,
	getScreenOverlayWindow,
}) {
	const restartCooldownMs = 5000;
	let lastRecoveryAt = 0;

	function isRecoveryOnCooldown() {
		const now = Date.now();
		if (now - lastRecoveryAt < restartCooldownMs) {
			return true;
		}
		lastRecoveryAt = now;
		return false;
	}

	function reloadWindowSafely(browserWindow, label, reason) {
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

	function recoverByReloadingWindows(reason) {
		if (isRecoveryOnCooldown()) {
			console.error(`Skipping recovery for ${reason} due to cooldown.`);
			return;
		}
		reloadWindowSafely(getAppWindow(), 'app window', reason);
		reloadWindowSafely(getScreenOverlayWindow(), 'screen overlay window', reason);
	}

	app.on('render-process-gone', (_event, webContents, details) => {
		const reason = details?.reason || 'unknown';
		console.error('Renderer process gone:', {
			reason,
			exitCode: details?.exitCode,
			name: details?.name,
		});

		// Normal shutdown/navigation should not trigger recovery.
		if (reason === 'clean-exit') {
			return;
		}

		if (isRecoveryOnCooldown()) {
			console.error(`Skipping renderer recovery for ${reason} due to cooldown.`);
			return;
		}

		const ownerWindow = BrowserWindow.fromWebContents(webContents);
		reloadWindowSafely(ownerWindow, 'renderer window', `renderer ${reason}`);
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

		// Keep recovery simple: if GPU/utility/video-related subprocesses die,
		// reload both windows so camera/WebGL pipelines can reinitialize.
		if (type === 'GPU' || type === 'Utility') {
			recoverByReloadingWindows(`${type.toLowerCase()} process ${reason}`);
		}
	});
}

module.exports = {
	installCrashRecovery,
};
