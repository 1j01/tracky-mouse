"use strict";

/* global process, module, require */

// Expose a tiny native helper. On Windows this calls into a
// native module which sends a small relative mouse move.
// On other platforms it is a no-op.

if (process.platform === "win32") {
	try {
		module.exports = require("./build/Release/tracky_mouse_native.node");
	} catch (_error) {
		console.warn("Failed to load tracky-mouse-native module; cursor visibility workaround disabled.", _error);
		module.exports = {
			ensureCursorVisible() {
				return false;
			},
		};
	}
} else {
	module.exports = {
		ensureCursorVisible() {
			return false;
		},
	};
}
