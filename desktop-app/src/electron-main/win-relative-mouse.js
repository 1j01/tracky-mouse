// Wrapper for a native module that issues a relative mouse move using SendInput.
// This is to ensure the cursor is made visible when you start controlling the computer with Tracky Mouse
// when using "Run at login", since the cursor is otherwise invisible until you physically jostle the mouse.
// Note: Calling the Win32 ShowCursor API does NOT make the cursor visible in this case.
// I've tested this using AutoHotKey, logging out and in with the mouse unplugged.

// NOTE: this code is AI generated, so don't put much weight on the implementation details.
// There's surely some weirdness in here, such as the conditional require here, and function naming,
// but I wanted a quick fix for the issue.

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
