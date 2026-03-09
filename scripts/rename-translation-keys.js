const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const thisScriptPath = path.resolve(__filename);
const ignoredDirNames = new Set(["node_modules", "out", ".git"]);
const excludedSourceDirs = new Set(["core/lib"]);
const sourceRoots = [
	path.join(rootDir, "core"),
	path.join(rootDir, "desktop-app", "src"),
	path.join(rootDir, "scripts"),
	path.join(rootDir, "website"),
];

const keyMap = Object.fromEntries([
	["configuration object required for initDwellClicking", "api.errors.configRequired"],
	["config.targets is required (must be a CSS selector)", "api.errors.targetsRequired"],
	["config.targets must be a string (a CSS selector)", "api.errors.targetsMustBeSelectorString"],
	["config.targets is not a valid CSS selector", "api.errors.targetsInvalidSelector"],
	["config.click is required", "api.errors.clickRequired"],
	["%0 must be a function", "api.errors.notAFunction"],
	["config.retarget must be an array of objects", "api.errors.retargetMustBeArray"],
	["config.retarget[%0].from is required", "api.errors.retargetFromRequired"],
	["config.retarget[%0].to is required (although can be null to ignore the element)", "api.errors.retargetToRequired"],
	["config.retarget[%0].withinMargin must be a number", "api.errors.retargetWithinMarginMustBeNumber"],
	["config.retarget[%0].from must be a CSS selector string, an Element, or a function", "api.errors.retargetFromInvalidType"],
	["config.retarget[%0].to must be a CSS selector string, an Element, a function, or null", "api.errors.retargetToInvalidType"],
	["config.retarget[%0].from is not a valid CSS selector", "api.errors.retargetFromInvalidSelector"],
	["config.retarget[%0].to is not a valid CSS selector", "api.errors.retargetToInvalidSelector"],
	["Start", "ui.startStopButton.start"],
	["Stop", "ui.startStopButton.stop"],
	["Allow Camera Access", "ui.camera.allowAccess"],
	["Use my camera", "ui.camera.useMyCamera"],
	["Use demo footage", "ui.camera.useDemoFootage"],
	["You can control your entire computer with the <a href=\"https://trackymouse.js.org/\">TrackyMouse</a> desktop app.", "ui.desktopAppPromo.message"],
	["Cursor Movement", "settings.sections.cursorMovement.label"],
	["Tilt influence", "settings.tiltInfluence.label"],
	["Optical flow", "settings.tiltInfluence.sliderMin.alt1"],
	["Point tracking", "settings.pointTracking.label"],
	["Point tracking (2D)", "settings.tiltInfluence.sliderMin"],
	["Head tilt", "settings.tiltInfluence.sliderMax.alt1"],
	["Head tilt (3D)", "settings.tiltInfluence.sliderMax"],
	["Determines whether cursor movement is based on 3D head tilt, or 2D motion of the face in the camera feed.", "settings.tiltInfluence.description.alt1"],
	[`Blends between using point tracking (2D) and detected head tilt (3D).
- At 0% it will use only point tracking. This moves the cursor according to visible movement of 2D points on your face within the camera's view, so it responds to both head rotation and translation.
- At 100% it will use only head tilt. This uses an estimate of your face's orientation in 3D space, and ignores head translation. Note that this is smoothed, so it's not as responsive as point tracking. In this mode you never need to recenter by pushing the cursor to the edge of the screen.
- In between it will behave like an automatic calibration, subtly adjusting the point tracking to match the head tilt. This works by slowing down mouse movement that is moving away from the position that would be expected based on the head tilt, and (only past 80% on the slider) actively moving towards it.`, "settings.tiltInfluence.description"],
	["Motion threshold", "settings.motionThreshold.label"],
	["Free", "settings.motionThreshold.sliderMin"],
	["Steady", "settings.motionThreshold.sliderMax"],
	["Minimum distance to move the cursor in one frame, in pixels. Helps to fully stop the cursor.", "settings.motionThreshold.description"],
	["Movement less than this distance in pixels will be ignored.", "settings.motionThreshold.descriptionIgnoredMovement"],
	["Speed in pixels/frame required to move the cursor.", "settings.motionThreshold.descriptionSpeed"],
	["Horizontal sensitivity", "settings.pointTracking.horizontalSensitivity.label"],
	["Slow", "settings.shared.sliderMinSlow"],
	["Fast", "settings.shared.sliderMaxFast"],
	["Speed of cursor movement in response to horizontal head movement.", "settings.pointTracking.horizontalSensitivity.description"],
	["Vertical sensitivity", "settings.pointTracking.verticalSensitivity.label"],
	["Speed of cursor movement in response to vertical head movement.", "settings.pointTracking.verticalSensitivity.description"],
	["Smoothing", "settings.pointTracking.smoothing.label"],
	["Linear", "settings.shared.sliderMinLinear"],
	["Smooth", "settings.shared.sliderMaxSmooth"],
	["Acceleration", "settings.pointTracking.acceleration.label"],
	["Higher acceleration makes the cursor move faster when the head moves quickly, and slower when the head moves slowly.", "settings.pointTracking.acceleration.description.alt1"],
	["Makes the cursor move extra fast for quick head movements, and extra slow for slow head movements. Helps to stabilize the cursor.", "settings.pointTracking.acceleration.description.alt2"],
	[`Makes the cursor move relatively fast for quick head movements, and relatively slow for slow head movements.
Helps to stabilize the cursor. However, when using point tracking in combination with head tilt, a lower value may work better since head tilt is linear, and you want the point tracking to roughly match the head tracking for it to act as a seamless auto-calibration.`, "settings.pointTracking.acceleration.description"],
	["Head tilt calibration", "settings.sections.headTiltCalibration.label"],
	["Horizontal tilt range", "settings.headTilt.horizontalRange.label"],
	["Little neck movement", "settings.headTilt.range.sliderMinLittleNeckMovement"],
	["Large neck movement", "settings.headTilt.range.sliderMaxLargeNeckMovement"],
	["Range of horizontal head tilt that moves the cursor from one side of the screen to the other.", "settings.headTilt.horizontalRange.descriptionRange"],
	["How much you need to tilt your head left and right to reach the edges of the screen.", "settings.headTilt.horizontalRange.descriptionEdges"],
	["How much you need to tilt your head left or right to reach the edge of the screen.", "settings.headTilt.horizontalRange.descriptionEdge"],
	["Controls how much you need to tilt your head left or right to reach the edge of the screen.", "settings.headTilt.horizontalRange.description"],
	["Vertical tilt range", "settings.headTilt.verticalRange.label"],
	["Range of vertical head tilt required to move the cursor from the top to the bottom of the screen.", "settings.headTilt.verticalRange.descriptionRange"],
	["How much you need to tilt your head up and down to reach the edges of the screen.", "settings.headTilt.verticalRange.descriptionEdges"],
	["How much you need to tilt your head up or down to reach the edge of the screen.", "settings.headTilt.verticalRange.descriptionEdge"],
	["Controls how much you need to tilt your head up or down to reach the edge of the screen.", "settings.headTilt.verticalRange.description"],
	["Horizontal cursor offset", "settings.headTilt.horizontalOffset.label"],
	["Left", "settings.shared.directionLeft"],
	["Right", "settings.shared.directionRight"],
	["Adjusts the center position of horizontal head tilt. Not recommended. Move the camera instead if possible.", "settings.headTilt.horizontalOffset.description.alt1"],
	["Adjusts the center position of horizontal head tilt. This horizontal offset is not recommended. Move the camera instead if possible.", "settings.headTilt.horizontalOffset.description.alt2"],
	["Adjusts the position of the cursor when the camera sees the head facing straight ahead.", "settings.headTilt.offset.description"],
	[`Adjusts the position of the cursor when the camera sees the head facing straight ahead.
⚠️ This horizontal offset is not recommended. Move the camera instead if possible. 📷`, "settings.headTilt.horizontalOffset.description"],
	["Vertical cursor offset", "settings.headTilt.verticalOffset.label"],
	["Down", "settings.shared.directionDown"],
	["Up", "settings.shared.directionUp"],
	["Adjusts the center position of vertical head tilt.", "settings.headTilt.offset.description.alt1"],
	["Clicking", "settings.sections.clicking.label"],
	["Clicking mode:", "settings.clickingMode.label"],
	["Dwell to click", "settings.clickingMode.dwell.label"],
	["Hold the cursor in place for a short time to click.", "settings.clickingMode.dwell.description"],
	["Wink to click", "settings.clickingMode.wink.label"],
	["Close one eye to click. Left eye for left click, right eye for right click.", "settings.clickingMode.wink.description"],
	["Open mouth to click (simple)", "settings.clickingMode.openMouthSimple.label"],
	["Open your mouth wide to click. At least one eye must be open to click.", "settings.clickingMode.openMouthSimple.description"],
	["Open mouth to click (ignoring eyes)", "settings.clickingMode.openMouthIgnoringEyes.label"],
	["Open your mouth wide to click. Eye state is ignored.", "settings.clickingMode.openMouthIgnoringEyes.description"],
	["Open mouth to click (with eye modifiers)", "settings.clickingMode.openMouthWithEyeModifiers.label"],
	["Open your mouth wide to click. If left eye is closed, it's a right click; if right eye is closed, it's a middle click.", "settings.clickingMode.openMouthWithEyeModifiers.description"],
	["Off", "settings.clickingMode.off.label"],
	["Disable clicking. Use with an external switch or programs that provide their own dwell clicking.", "settings.clickingMode.off.description"],
	["Choose how to perform mouse clicks.", "settings.clickingMode.description"],
	["Swap mouse buttons", "settings.swapMouseButtons.label"],
	[`Switches the left and right mouse buttons.
Useful if your system's mouse buttons are swapped.
Could also be used to right click with the dwell clicker in a pinch.`, "settings.swapMouseButtons.description"],
	["Delay before dragging", "settings.delayBeforeDragging.label"],
	["Easy to drag", "settings.delayBeforeDragging.sliderMin"],
	["Easy to click", "settings.delayBeforeDragging.sliderMax"],
	["Locks mouse movement during the start of a click to prevent accidental dragging.", "settings.delayBeforeDragging.description.alt1"],
	[`Prevents mouse movement for the specified time after a click starts.
You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.`, "settings.delayBeforeDragging.description.alt2"],
	[`Prevents mouse movement for the specified time after a click starts.
					// You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.`, "settings.delayBeforeDragging.description.alt2"],
	[`Locks mouse movement for the given duration during the start of a click.
You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.`, "settings.delayBeforeDragging.description"],
	["Video", "settings.sections.video.label"],
	["Camera source", "settings.cameraSource.label"],
	["Default", "common.default"],
	["Select which camera to use for head tracking.", "settings.cameraSource.description.alt1"],
	["Selects which camera is used for head tracking.", "settings.cameraSource.description"],
	["Open Camera Settings", "settings.openCameraSettings.label"],
	["Failed to open camera settings:", "settings.openCameraSettings.errorOpen"],
	["Failed to parse known cameras from localStorage:", "settings.openCameraSettings.errorParseKnownCameras"],
	["Open your camera's system settings window to adjust properties like brightness and contrast.", "settings.openCameraSettings.descriptionBrightnessContrast"],
	["Opens the system settings window for your camera to adjust properties like auto-focus and auto-exposure.", "settings.openCameraSettings.descriptionWindow"],
	["Opens the system settings dialog for the selected camera, to adjust properties like auto-focus and auto-exposure.", "settings.openCameraSettings.description"],
	["Mirror", "settings.mirror.label"],
	["Mirrors the camera view horizontally.", "settings.mirror.description"],
	["General", "settings.sections.general.label"],
	["Start enabled", "settings.startEnabled.label"],
	["If enabled, Tracky Mouse will start controlling the cursor as soon as it's launched.", "settings.startEnabled.description"],
	["Makes Tracky Mouse active when launched. Otherwise, you can start it manually when you're ready.", "settings.startEnabled.description.alt1"],
	["Makes Tracky Mouse active as soon as it's launched.", "settings.startEnabled.description.alt2"],
	["Automatically starts Tracky Mouse as soon as it's run.", "settings.startEnabled.description.alt3"],
	["Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"• There is currently no visual or auditory feedback.\n• There are no settings for duration(s) to toggle on and off.\n• It is affected by false positive blink detections, especially when looking downward.\">Experimental</span>)", "settings.closeEyesToToggle.label"],
	["If enabled, you can start or stop mouse control by holding both your eyes shut for a few seconds.", "settings.closeEyesToToggle.description"],
	["Run at login", "settings.runAtLogin.label"],
	["If enabled, Tracky Mouse will automatically start when you log into your computer.", "settings.runAtLogin.description"],
	["Makes Tracky Mouse start automatically when you log into your computer.", "settings.runAtLogin.description.alt1"],
	["Check for updates", "settings.checkForUpdates.label"],
	["If enabled, Tracky Mouse will automatically check for updates when it starts.", "settings.checkForUpdates.description"],
	["Notifies you of new versions of Tracky Mouse.", "settings.checkForUpdates.description.alt1"],
	["Notifies you when a new version of Tracky Mouse is available.", "settings.checkForUpdates.description.alt2"],
	["Language", "settings.language.label"],
	["Select the language for the Tracky Mouse interface.", "settings.language.description"],
	["Changes the language Tracky Mouse is displayed in.", "settings.language.description.alt1"],
	["Options:", "settings.options.label"],
	["Camera %0", "video.cameraSource.cameraNumber"],
	["Unavailable", "common.unavailable"],
	["Unavailable camera", "video.cameraSource.unavailableCamera"],
	["No camera found. Please make sure you have a camera connected and enabled.", "video.errors.noCameraFound"],
	["Webcam is already in use. Please make sure you have no other programs using the camera.", "video.errors.cameraInUse"],
	["Please make sure no other programs are using the camera and try again.", "video.errors.tryAgainAfterOtherPrograms"],
	["The previously selected camera is not available. Try selecting \"Default\" for Video > Camera source, and then select a specific camera if you need to.", "video.errors.previouslySelectedUnavailable"],
	["Webcam does not support the required resolution. Please change your settings.", "video.errors.unsupportedResolution"],
	["Permission denied. Please enable access to the camera.", "video.errors.permissionDenied"],
	["Something went wrong accessing the camera.", "video.errors.accessFailed"],
	["Something went wrong accessing the camera. Please try again.", "video.errors.accessFailedRetry"],
	["⚠️", "common.warningIcon"],
	["Pitch:", "debug.headTilt.pitch"],
	["Yaw:", "debug.headTilt.yaw"],
	["Roll:", "debug.headTilt.roll"],
	["Face convergence score:", "debug.faceConvergenceScore"],
	["N/A", "common.notApplicable"],
	["Face tracking score:", "debug.faceTrackingScore"],
	["Points based on score:", "debug.pointsBasedOnScore"],
	["Control your mouse hands-free. This CLI controls the running Tracky Mouse app. It's meant for external programs like a voice command system to toggle Tracky Mouse and adjust settings on the fly.", "cli.description"],
	["The settings profile to use.", "cli.args.profile.description"],
	["Change an option to a particular value. (Also outputs the new value, which may be constrained to some limits.)", "cli.args.set.description"],
	["Adjust an option by an amount relative to its current value. (Also outputs the new value, which may be constrained to some limits.)", "cli.args.adjust.description"],
	["Outputs the current value of an option.", "cli.args.get.description"],
	["Start head tracking.", "cli.args.start.description"],
	["Stop head tracking.", "cli.args.stop.description"],
	["Show the version number.", "cli.args.version.description"],
	["Will resume after mouse stops moving.", "hud.willResumeAfterMouseStops"],
	["Press %0 to toggle Tracky Mouse.", "hud.pressToToggle"],
	["Press %0 to disable Tracky Mouse.", "hud.pressToDisable"],
	["Press %0 to enable Tracky Mouse.", "hud.pressToEnable"],
	["About Tracky Mouse", "desktop.about.title"],
	["Control your computer with your webcam.", "desktop.about.description"],
	["File", "desktop.menu.file"],
	["Export Settings", "desktop.menu.exportSettings"],
	["Export", "desktop.menu.export"],
	["JSON", "common.fileTypeJson"],
	["Failed to export settings.", "desktop.menu.exportSettingsError"],
	["Import Settings", "desktop.menu.importSettings"],
	["Import", "desktop.menu.import"],
	["Failed to read selected file.", "desktop.menu.importReadError"],
	["Failed to backup current settings before import.", "desktop.menu.importBackupError"],
	["Failed to import settings.", "desktop.menu.importError"],
	["Edit", "desktop.menu.edit"],
	["Speech", "desktop.menu.speech"],
	["View", "desktop.menu.view"],
	["Toggle Developer Tools (Screen Overlay)", "desktop.menu.toggleScreenOverlayDevtools"],
	["Window", "desktop.menu.window"],
	["Home Page", "desktop.menu.homePage"],
	["GitHub Repository", "desktop.menu.githubRepository"],
	["Update from Git", "desktop.updater.action.updateFromGit"],
	["Remind me later", "desktop.updater.action.remindMeLater"],
	["Skip this version", "desktop.updater.action.skipThisVersion"],
	["Download", "desktop.updater.action.download"],
	["Update Available", "desktop.updater.updateAvailable.title"],
	["A new version of Tracky Mouse is available: %0\n\nYou are currently using version %1.", "desktop.updater.updateAvailable.message"],
	["Since this is a git repository, the update can be pulled directly.", "desktop.updater.updateAvailable.gitRepoNote"],
	["Update Successful", "desktop.updater.updateSuccessful.title"],
	["Checked out %0. Restart the app to use the updated version.", "desktop.updater.updateSuccessful.message"],
	["Restart Now", "desktop.updater.action.restartNow"],
	["Later", "common.later"],
	["Couldn't fetch updates from git.", "desktop.updater.errors.fetch"],
	["Couldn't checkout the latest version in the local git repository. You may have uncommitted changes.", "desktop.updater.errors.checkout"],
	["Failed to install dependencies for the new version after checking it out from git.", "desktop.updater.errors.installDependencies"],
	["An error occurred while updating from git.", "desktop.updater.errors.generic"],
	["Update Failed", "desktop.updater.updateFailed.title"],
	["Open download page", "desktop.updater.action.openDownloadPage"],
	["Close", "common.close"],
]);

const semanticKeyRenameMap = Object.fromEntries([
	["settings.tiltInfluence.sliderMinOpticalFlow", "settings.tiltInfluence.sliderMin.alt1"],
	["settings.tiltInfluence.sliderMinPointTracking2d", "settings.tiltInfluence.sliderMin"],
	["settings.tiltInfluence.sliderMaxHeadTilt", "settings.tiltInfluence.sliderMax.alt1"],
	["settings.tiltInfluence.sliderMaxHeadTilt3d", "settings.tiltInfluence.sliderMax"],
	["settings.tiltInfluence.descriptionShort", "settings.tiltInfluence.description.alt1"],
	["settings.pointTracking.acceleration.descriptionLegacy", "settings.pointTracking.acceleration.description.alt1"],
	["settings.pointTracking.acceleration.descriptionAlternate", "settings.pointTracking.acceleration.description.alt2"],
	["settings.headTilt.horizontalOffset.descriptionLegacy", "settings.headTilt.horizontalOffset.description.alt1"],
	["settings.headTilt.horizontalOffset.descriptionAlternate", "settings.headTilt.horizontalOffset.description.alt2"],
	["settings.headTilt.verticalOffset.descriptionLegacy", "settings.headTilt.offset.description.alt1"],
	["settings.delayBeforeDragging.descriptionLegacy", "settings.delayBeforeDragging.description.alt1"],
	["settings.cameraSource.descriptionLegacy", "settings.cameraSource.description.alt1"],
	["settings.startEnabled.descriptionAlternate", "settings.startEnabled.description.alt1"],
	["settings.startEnabled.descriptionImmediate", "settings.startEnabled.description.alt2"],
	["settings.startEnabled.descriptionAutomatic", "settings.startEnabled.description.alt3"],
	["settings.runAtLogin.descriptionAlternate", "settings.runAtLogin.description.alt1"],
	["settings.checkForUpdates.descriptionAlternate", "settings.checkForUpdates.description.alt1"],
	["settings.checkForUpdates.descriptionAvailable", "settings.checkForUpdates.description.alt2"],
	["settings.language.descriptionAlternate", "settings.language.description.alt1"],
]);

const todoCallPattern = /t\("@TODO_KEY",\s*\{\s*defaultValue:\s*("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`)\s*\}\)/g;

function evaluateLiteral(literal) {
	return Function(`"use strict"; return (${literal});`)();
}

function normalizeRelativePath(filePath) {
	return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function shouldIgnoreDirectory(dirPath) {
	if (fs.lstatSync(dirPath).isSymbolicLink()) {
		return true;
	}
	const relativePath = normalizeRelativePath(dirPath);
	if (excludedSourceDirs.has(relativePath)) {
		return true;
	}
	return ignoredDirNames.has(path.basename(dirPath));
}

function collectFilesRecursively(dirPath, predicate, results = []) {
	for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			if (!shouldIgnoreDirectory(fullPath)) {
				collectFilesRecursively(fullPath, predicate, results);
			}
			continue;
		}
		if (entry.isFile() && predicate(fullPath)) {
			results.push(fullPath);
		}
	}
	return results;
}

function listSourceFiles() {
	const sourceFiles = sourceRoots.flatMap((dirPath) => collectFilesRecursively(
		dirPath,
		(filePath) => filePath.endsWith(".js") && path.resolve(filePath) !== thisScriptPath,
	));
	for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
		if (!entry.isFile()) {
			continue;
		}
		const fullPath = path.join(rootDir, entry.name);
		if ((fullPath.endsWith(".js") || fullPath.endsWith(".ts")) && path.resolve(fullPath) !== thisScriptPath) {
			sourceFiles.push(fullPath);
		}
	}
	return sourceFiles;
}

function listLocaleFiles() {
	const localesDir = path.join(rootDir, "core", "locales");
	return fs.readdirSync(localesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(localesDir, entry.name, "translation.json"))
		.filter((filePath) => fs.existsSync(filePath));
}

function formatPlan(changesByFile) {
	return Object.entries(changesByFile)
		.sort(([fileA], [fileB]) => fileA.localeCompare(fileB))
		.map(([filePath, count]) => `- ${filePath}: ${count} replacement${count === 1 ? "" : "s"}`)
		.join("\n");
}

function printModeSummary({ renameSource, renameLocales, apply }) {
	console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (no files will be modified)");
	if (renameSource) {
		console.log(`Source roots: ${sourceRoots.map(normalizeRelativePath).join(", ")}, plus top-level *.js/*.ts`);
		console.log(`Excluded source dirs: ${Array.from(excludedSourceDirs).join(", ") || "(none)"}`);
		console.log("Symlinked directories are skipped.");
	}
	if (renameLocales) {
		console.log("Locale files: core/locales/*/translation.json");
	}
}

function replaceQuotedValue(content, oldValue, newValue) {
	let nextContent = content;
	let replacementCount = 0;
	for (const quote of ['"', "'"]) {
		const oldLiteral = `${quote}${oldValue}${quote}`;
		const newLiteral = `${quote}${newValue}${quote}`;
		if (nextContent.includes(oldLiteral)) {
			const count = nextContent.split(oldLiteral).length - 1;
			nextContent = nextContent.split(oldLiteral).join(newLiteral);
			replacementCount += count;
		}
	}
	return { nextContent, replacementCount };
}

function replaceTodoKeysInSource({ apply }) {
	const files = listSourceFiles();
	const missing = [];
	const changesByFile = {};
	for (const filePath of files) {
		const content = fs.readFileSync(filePath, "utf8");
		if (!content.includes("@TODO_KEY")) {
			continue;
		}
		let replacementCount = 0;
		const nextContent = content.replace(todoCallPattern, (match, literal) => {
			const oldKey = evaluateLiteral(literal);
			const newKey = keyMap[oldKey];
			if (!newKey) {
				missing.push({ filePath, oldKey });
				return match;
			}
			replacementCount += 1;
			return `t(${JSON.stringify(newKey)}, { defaultValue: ${literal} })`;
		});
		if (nextContent !== content) {
			changesByFile[normalizeRelativePath(filePath)] = replacementCount;
			if (apply) {
				fs.writeFileSync(filePath, nextContent, "utf8");
			}
		}
	}
	if (missing.length > 0) {
		const lines = missing.map(({ filePath, oldKey }) => `${normalizeRelativePath(filePath)} -> ${JSON.stringify(oldKey)}`);
		throw new Error(`Missing semantic key mappings:\n${lines.join("\n")}`);
	}
	return changesByFile;
}

function renameSemanticKeysInSource({ apply }) {
	const files = listSourceFiles();
	const changesByFile = {};
	for (const filePath of files) {
		const content = fs.readFileSync(filePath, "utf8");
		let nextContent = content;
		let replacementCount = 0;
		for (const [oldKey, newKey] of Object.entries(semanticKeyRenameMap)) {
			const result = replaceQuotedValue(nextContent, oldKey, newKey);
			nextContent = result.nextContent;
			replacementCount += result.replacementCount;
		}
		if (nextContent !== content) {
			changesByFile[normalizeRelativePath(filePath)] = replacementCount;
			if (apply) {
				fs.writeFileSync(filePath, nextContent, "utf8");
			}
		}
	}
	return changesByFile;
}

function mergeChangeCounts(...changeMaps) {
	const merged = {};
	for (const changeMap of changeMaps) {
		for (const [filePath, count] of Object.entries(changeMap)) {
			merged[filePath] = (merged[filePath] || 0) + count;
		}
	}
	return merged;
}

function renameLocaleKeys({ apply }) {
	const localeFiles = listLocaleFiles();
	const changesByFile = {};
	for (const filePath of localeFiles) {
		const content = fs.readFileSync(filePath, "utf8");
		const translations = JSON.parse(content);
		const renamed = {};
		let changed = false;
		let replacementCount = 0;
		for (const [oldKey, value] of Object.entries(translations)) {
			const semanticKey = keyMap[oldKey] ?? oldKey;
			const newKey = semanticKeyRenameMap[semanticKey] ?? semanticKey;
			if (newKey !== oldKey) {
				changed = true;
				replacementCount += 1;
			}
			if (Object.prototype.hasOwnProperty.call(renamed, newKey)) {
				throw new Error(`Duplicate target key ${newKey} while processing ${normalizeRelativePath(filePath)}`);
			}
			renamed[newKey] = value;
		}
		if (changed) {
			changesByFile[normalizeRelativePath(filePath)] = replacementCount;
			if (apply) {
				fs.writeFileSync(filePath, `${JSON.stringify(renamed, null, 2)}\n`, "utf8");
			}
		}
	}
	return changesByFile;
}

function main() {
	const args = new Set(process.argv.slice(2));
	const renameSource = args.has("--source");
	const renameLocales = args.has("--locales");
	const apply = args.has("--apply");
	if (!renameSource && !renameLocales) {
		console.error("Usage: node scripts/rename-translation-keys.js [--source] [--locales] [--apply]");
		console.error("By default the script performs a dry run and prints the files it would change.");
		process.exit(1);
	}
	printModeSummary({ renameSource, renameLocales, apply });
	const sourceChanges = renameSource ? mergeChangeCounts(
		replaceTodoKeysInSource({ apply }),
		renameSemanticKeysInSource({ apply }),
	) : {};
	const localeChanges = renameLocales ? renameLocaleKeys({ apply }) : {};
	if (renameSource) {
		console.log(`Source files to ${apply ? "update" : "update (dry run)"}: ${Object.keys(sourceChanges).length}`);
		if (Object.keys(sourceChanges).length > 0) {
			console.log(formatPlan(sourceChanges));
		}
	}
	if (renameLocales) {
		console.log(`Locale files to ${apply ? "update" : "update (dry run)"}: ${Object.keys(localeChanges).length}`);
		if (Object.keys(localeChanges).length > 0) {
			console.log(formatPlan(localeChanges));
		}
	}
	if (!apply) {
		console.log("Dry run complete. Re-run with --apply to write these changes.");
	}
}

main();
