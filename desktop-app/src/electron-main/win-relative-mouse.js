'use strict';

const bindings = process.platform === 'win32' ? require('bindings') : null;

let native = null;
let triedToLoadNative = false;
let sentInitialRelativeMove = false;

function loadNative() {
	if (triedToLoadNative) {
		return native;
	}
	triedToLoadNative = true;

	if (process.platform !== 'win32' || !bindings) {
		return null;
	}

	try {
		// This native helper issues a single relative mouse move using SendInput.
		// Note: Calling the Win32 ShowCursor API does NOT reliably make the cursor
		// visible at login for this app; that has been tested.
		native = bindings('win_relative_mouse');
	} catch (error) {
		console.error('Failed to load win_relative_mouse native module. Relative mouse move workaround will be skipped.', error);
		native = null;
	}

	return native;
}

function ensureInitialRelativeMouseMove() {
	if (sentInitialRelativeMove) {
		return;
	}

	if (process.platform !== 'win32') {
		// Only needed on Windows; other platforms do not exhibit the
		// invisible-cursor-after-login behavior in the same way.
		return;
	}

	const mod = loadNative();
	if (!mod || typeof mod.sendRelativeMouseMove !== 'function') {
		return;
	}

	sentInitialRelativeMove = true;

	try {
		// A tiny relative move is enough to wake up the cursor.
		mod.sendRelativeMouseMove(1, 0);
	} catch (error) {
		console.error('Failed to send initial relative mouse move.', error);
	}
}

module.exports = {
	ensureInitialRelativeMouseMove,
};
