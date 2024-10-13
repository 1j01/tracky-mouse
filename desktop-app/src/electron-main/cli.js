const { ArgumentParser, SUPPRESS, RawDescriptionHelpFormatter } = require("argparse");

const parser = new ArgumentParser({
	prog: "tracky-mouse",
	description: "Control your mouse hands-free. This CLI controls the running Tracky Mouse app. It's meant for external programs like a voice command system to toggle Tracky Mouse and adjust settings on the fly.",
	epilog: `Configuration Options (for use with --set, --adjust, and --get):
- "startEnabled" controls whether head tracking is enabled when the app starts. default: false
- "runAtLogin" controls whether the app starts when you log in. default: false
- "swapMouseButtons" swaps the left and right mouse buttons. Should be synced with the system setting in order for the dwell clicker to trigger primary clicks. default: false
- "mirrorCameraView" mirrors the camera view horizontally. default: true
- "headTrackingSensitivityX" controls how much the mouse moves horizontally in response to head movement. default: ?
- "headTrackingSensitivityY" controls how much the mouse moves vertically in response to head movement. default: ?
- "headTrackingAcceleration" controls smoothness of mouse movement; 0 is linear, 1 is smoothest. default: ?
- "dwellTime" controls how long the mouse must be over a point before a click is registered. default: ?
`,
	// Without this, the epilog's line breaks are ignored!
	// However, this might not be a good general solution, since it could break the formatting of other help text.
	formatter_class: RawDescriptionHelpFormatter,
});

// Should this support loading by name or by file path? Should it have two separate options?
parser.add_argument("--profile", {
	help: "The settings profile to use.",
	nargs: 1,
	metavar: "PROFILE",
});

parser.add_argument("--set", {
	help: "Change an option to a particular value. (Also outputs the new value, which may be constrained to some limits.)",
	nargs: 2,
	metavar: ["OPTION", "VALUE"],
	action: "append",
});

parser.add_argument("--adjust", {
	help: "Adjust an option by an amount relative to its current value. (Also outputs the new value, which may be constrained to some limits.)",
	nargs: 2,
	metavar: ["OPTION", "DELTA"],
	action: "append",
});

parser.add_argument("--get", {
	help: "Outputs the current value of an option.",
	nargs: 1,
	metavar: "OPTION",
	action: "append",
});

// TODO: Need to decide how to handle toggling mouse movement vs dwell clicking...
parser.add_argument("--start", {
	help: "Start head tracking.",
	action: "store_true",
});

parser.add_argument("--stop", {
	help: "Stop head tracking.",
	action: "store_true",
});

parser.add_argument("-v", "--version", {
	action: "version",
	version: require("../../package.json").version,
});

// Squirrel.Windows passes "--squirrel-firstrun" when the app is first run after being installed.
// This could be used to show a "Thanks for installing" message or similar, but it needs to at least be handled so that it doesn't cause an error.
// We can hide it from the help since it's not a useful option.
parser.add_argument("--squirrel-firstrun", {
	help: SUPPRESS,
	action: "store_true",
});

// Other Squirrel.Windows event argument are CURRENTLY handled separately in electron-main.js, but could make use of the argparse CLI...

// parser.add_argument("--squirrel-uninstall", {
// 	help: SUPPRESS,
// 	action: "store_true",
// });

// parser.add_argument("--squirrel-install", {
// 	help: SUPPRESS,
// 	action: "store_true",
// });

// parser.add_argument("--squirrel-updated", {
// 	help: SUPPRESS,
// 	action: "store_true",
// });

// parser.add_argument("--squirrel-obsolete", {
// 	help: SUPPRESS,
// 	action: "store_true",
// });

module.exports.parser = parser;
