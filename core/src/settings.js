import { setAudioEnabled } from "./audio.js";
import { availableLanguages, getLanguageFlagEmoji, languageNames, } from "./languages.js";
import { TrackyMouse } from "./tracky-mouse.js";

// TODO: clean up signature which is roughly "whatever dependencies were needed to extract this code to a new file"
export function getSettingsCategories({
	t,
	locale,
	serializeSettings,
	reinit,
	s,
	isDesktopApp,
	clickingModeSupported,
	cameraVideo,
	setPaused,
}) {

	const addExperimentalLabel = (label, hoverText) =>
		// Note: this is a bit messy. It could replace "%1" within `label` if present; and it's not escaping HTML.
		t("ui.experimentalLabel", { defaultValue: "%0 (%1Experimental%2)" })
			.replace("%0", label)
			.replace("%1", `<span class="tracky-mouse-experimental-label" title="${hoverText}">`)
			.replace("%2", "</span>");

	// Abstract model of settings UI.
	// Note: min, max, and default are in INPUT value units, not setting value units.
	// TODO: make min/max/default be in setting value units, and automatically define
	// input unit scale to avoid rounding to 0 or 1 for fractions (for example) - or use step?
	const settingsCategories = [
		{
			type: "group",
			label: t("settings.sections.cursorMovement.label", { defaultValue: "Cursor Movement" }),
			settings: [
				{
					label: addExperimentalLabel(t("settings.movementMode.label", { defaultValue: "Movement mode" }), t("settings.movementMode.experimentalLabelHoverText", { defaultValue: "This is a new feature, and it may not work with all the other settings." })),
					className: "tracky-mouse-movement-mode",
					key: "headTrackingMovementMode",
					type: "dropdown",
					default: "direct",
					options: [
						{ value: "direct", label: t("settings.movementMode.direct.label", { defaultValue: "🖾 Direct" }), description: t("settings.movementMode.direct.description", { defaultValue: "Moves the cursor when you move your head." }) },
						{ value: "joystick", label: t("settings.movementMode.joystick.label", { defaultValue: "● Joystick style (any direction)" }), description: t("settings.movementMode.joystick.description", { defaultValue: "Moves the cursor continuously in the direction of your head." }) },
						{ value: "joystick-4dir", label: t("settings.movementMode.joystick4dir.label", { defaultValue: "✦ D-pad style (4 directions)" }), description: t("settings.movementMode.joystick4dir.description", { defaultValue: "Moves the cursor continuously in the direction of your head, limited to four directions (up, down, left, and right)." }) },
						{ value: "joystick-6dir", label: t("settings.movementMode.joystick6dir.label", { defaultValue: "✶ D-pad style (6 directions)" }), description: t("settings.movementMode.joystick6dir.description", { defaultValue: "Moves the cursor continuously in the direction of your head, limited to six directions. Intended for isometric game worlds." }) },
						{ value: "joystick-8dir", label: t("settings.movementMode.joystick8dir.label", { defaultValue: "✷ D-pad style (8 directions)" }), description: t("settings.movementMode.joystick8dir.description", { defaultValue: "Moves the cursor continuously in the direction of your head, limited to eight directions (up, down, left, right, or diagonal)." }) },
					],
					description: t("settings.movementMode.description", { defaultValue: "Choose how head movement is translated into cursor movement." }),
				},
				{
					label: t("settings.tiltInfluence.label", { defaultValue: "Tilt influence" }),
					className: "tracky-mouse-tilt-influence",
					key: "headTrackingTiltInfluence",
					settingValueToInputValue: (settingValue) => settingValue * 100,
					inputValueToSettingValue: (inputValue) => inputValue / 100,
					type: "slider",
					min: 0,
					max: 100,
					default: 0,
					labels: {
						// min: t("settings.tiltInfluence.sliderMin.alt1", { defaultValue: "Optical flow" }), // too technical
						// min: t("settings.tiltInfluence.sliderMin.alt2", { defaultValue: "Point tracking" }), // still technical but at least it's terminology we're already using
						min: t("settings.tiltInfluence.sliderMin", { defaultValue: "Point tracking (2D)" }),
						// max: t("settings.tiltInfluence.sliderMax.alt1", { defaultValue: "Head tilt" }),
						max: t("settings.tiltInfluence.sliderMax", { defaultValue: "Head tilt (3D)" }),
					},
					// description: t("settings.tiltInfluence.description.alt1", { defaultValue: "Determines whether cursor movement is based on 3D head tilt, or 2D motion of the face in the camera feed." }),
					description: t("settings.tiltInfluence.description", {
						defaultValue: `Blends between using point tracking (2D) and detected head tilt (3D).
- At 0% it will use only point tracking. This moves the cursor according to visible movement of 2D points on your face within the camera's view, so it responds to both head rotation and translation.
- At 100% it will use only head tilt. This uses an estimate of your face's orientation in 3D space, and ignores head translation. Note that this is smoothed, so it's not as responsive as point tracking. In this mode you never need to recenter by pushing the cursor to the edge of the screen.
- In between it will behave like an automatic calibration, subtly adjusting the point tracking to match the head tilt. This works by slowing down mouse movement that is moving away from the position that would be expected based on the head tilt, and (only past 80% on the slider) actively moving towards it.` }),
				},
				{
					label: t("settings.motionThreshold.label", { defaultValue: "Motion threshold" }),
					className: "tracky-mouse-min-distance",
					key: "headTrackingMinDistance",
					type: "slider",
					min: 0,
					max: 10,
					default: 0,
					labels: {
						min: t("settings.motionThreshold.sliderMin", { defaultValue: "Free" }),
						max: t("settings.motionThreshold.sliderMax", { defaultValue: "Steady" }),
					},
					description: t("settings.motionThreshold.description", { defaultValue: "Minimum distance to move the cursor in one frame, in pixels. Helps to fully stop the cursor." }),
					// description: t("settings.motionThreshold.description.alt1", { defaultValue: "Movement less than this distance in pixels will be ignored." }),
					// description: t("settings.motionThreshold.description.alt2", { defaultValue: "Speed in pixels/frame required to move the cursor." }),
				},
				{
					type: "group",
					label: t("settings.sections.pointTracking.label", { defaultValue: "Point tracking" }),
					disabled: () => s.headTrackingTiltInfluence === 1,
					settings: [
						{
							label: t("settings.pointTracking.horizontalSensitivity.label", { defaultValue: "Horizontal sensitivity" }),
							className: "tracky-mouse-sensitivity-x",
							key: "headTrackingSensitivityX",
							settingValueToInputValue: (settingValue) => settingValue * 1000,
							inputValueToSettingValue: (inputValue) => inputValue / 1000,
							type: "slider",
							min: 0,
							max: 100,
							default: 25,
							labels: {
								min: t("settings.shared.sliderMinSlow", { defaultValue: "Slow" }),
								max: t("settings.shared.sliderMaxFast", { defaultValue: "Fast" }),
							},
							description: t("settings.pointTracking.horizontalSensitivity.description", { defaultValue: "Speed of cursor movement in response to horizontal head movement." }),
						},
						{
							label: t("settings.pointTracking.verticalSensitivity.label", { defaultValue: "Vertical sensitivity" }),
							className: "tracky-mouse-sensitivity-y",
							key: "headTrackingSensitivityY",
							settingValueToInputValue: (settingValue) => settingValue * 1000,
							inputValueToSettingValue: (inputValue) => inputValue / 1000,
							type: "slider",
							min: 0,
							max: 100,
							default: 50,
							labels: {
								min: t("settings.shared.sliderMinSlow", { defaultValue: "Slow" }),
								max: t("settings.shared.sliderMaxFast", { defaultValue: "Fast" }),
							},
							description: t("settings.pointTracking.verticalSensitivity.description", { defaultValue: "Speed of cursor movement in response to vertical head movement." }),
						},
						// {
						// 	label: t("settings.pointTracking.smoothing.label", { defaultValue: "Smoothing" }),
						// 	className: "tracky-mouse-smoothing",
						// 	key: "headTrackingSmoothing",
						// 	type: "slider",
						// 	min: 0,
						// 	max: 100,
						// 	default: 50,
						// 	labels: {
						// 		min: t("settings.shared.sliderMinLinear", { defaultValue: "Linear" }), // or "Direct", "Raw", "None"
						// 		max: t("settings.shared.sliderMaxSmooth", { defaultValue: "Smooth" }), // or "Smoothed"
						// 	},
						// },

						// TODO:
						// - eyeTrackingSensitivityX
						// - eyeTrackingSensitivityY
						// - eyeTrackingAcceleration

						// TODO: "Linear" could be described as "Fast", and the other "Fast" labels are on the other side.
						// Should it be swapped? What does other software with acceleration control look like?
						// In Windows it's just a checkbox apparently, but it could go as far as a custom curve editor.
						{
							label: t("settings.pointTracking.acceleration.label", { defaultValue: "Acceleration" }),
							className: "tracky-mouse-acceleration",
							key: "headTrackingAcceleration",
							settingValueToInputValue: (settingValue) => settingValue * 100,
							inputValueToSettingValue: (inputValue) => inputValue / 100,
							type: "slider",
							min: 0,
							max: 100,
							default: 50,
							labels: {
								min: t("settings.shared.sliderMinLinear", { defaultValue: "Linear" }), // or "Direct", "Raw"
								max: t("settings.shared.sliderMaxSmooth", { defaultValue: "Smooth" }),
							},
							// description: t("settings.pointTracking.acceleration.description.alt1", { defaultValue: "Higher acceleration makes the cursor move faster when the head moves quickly, and slower when the head moves slowly." }),
							// description: t("settings.pointTracking.acceleration.description.alt2", { defaultValue: "Makes the cursor move extra fast for quick head movements, and extra slow for slow head movements. Helps to stabilize the cursor." }),
							description: t("settings.pointTracking.acceleration.description", {
								defaultValue: `Makes the cursor move relatively fast for quick head movements, and relatively slow for slow head movements.
Helps to stabilize the cursor. However, when using point tracking in combination with head tilt, a lower value may work better since head tilt is linear, and you want the point tracking to roughly match the head tracking for it to act as a seamless auto-calibration.` }),
						},
					],
				},
				{
					type: "group",
					label: t("settings.sections.headTiltCalibration.label", { defaultValue: "Head tilt calibration" }),
					disabled: () => s.headTrackingTiltInfluence === 0,
					settings: [
						{
							label: t("settings.headTilt.horizontalRange.label", { defaultValue: "Horizontal tilt range" }),
							className: "tracky-mouse-head-tilt-yaw-range",
							key: "headTiltYawRange",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: 10,
							max: 90,
							default: 60,
							labels: {
								min: t("settings.headTilt.range.sliderMinLittleNeckMovement", { defaultValue: "Little neck movement" }),
								max: t("settings.headTilt.range.sliderMaxLargeNeckMovement", { defaultValue: "Large neck movement" }),
							},
							// description: t("settings.headTilt.horizontalRange.description.alt1", { defaultValue: "Range of horizontal head tilt that moves the cursor from one side of the screen to the other." }),
							// description: t("settings.headTilt.horizontalRange.description.alt2", { defaultValue: "How much you need to tilt your head left and right to reach the edges of the screen." }),
							// description: t("settings.headTilt.horizontalRange.description.alt3", { defaultValue: "How much you need to tilt your head left or right to reach the edge of the screen." }),
							description: t("settings.headTilt.horizontalRange.description", { defaultValue: "Controls how much you need to tilt your head left or right to reach the edge of the screen." }),
						},
						{
							label: t("settings.headTilt.verticalRange.label", { defaultValue: "Vertical tilt range" }),
							className: "tracky-mouse-head-tilt-pitch-range",
							key: "headTiltPitchRange",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: 10,
							max: 60,
							default: 25,
							labels: {
								min: t("settings.headTilt.range.sliderMinLittleNeckMovement", { defaultValue: "Little neck movement" }),
								max: t("settings.headTilt.range.sliderMaxLargeNeckMovement", { defaultValue: "Large neck movement" }),
							},
							// description: t("settings.headTilt.verticalRange.description.alt1", { defaultValue: "Range of vertical head tilt required to move the cursor from the top to the bottom of the screen." }),
							// description: t("settings.headTilt.verticalRange.description.alt2", { defaultValue: "How much you need to tilt your head up and down to reach the edges of the screen." }),
							// description: t("settings.headTilt.verticalRange.description.alt3", { defaultValue: "How much you need to tilt your head up or down to reach the edge of the screen." }),
							description: t("settings.headTilt.verticalRange.description", { defaultValue: "Controls how much you need to tilt your head up or down to reach the edge of the screen." }),
						},
						{
							// label: "Horizontal tilt offset",
							label: t("settings.headTilt.horizontalOffset.label", { defaultValue: "Horizontal cursor offset" }),
							className: "tracky-mouse-head-tilt-yaw-offset",
							key: "headTiltYawOffset",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: -45,
							max: 45,
							default: 0,
							labels: {
								min: t("settings.shared.directionLeft", { defaultValue: "Left" }),
								max: t("settings.shared.directionRight", { defaultValue: "Right" }),
							},
							// TODO: how to describe this??
							// Specifically, how to disambiguate which direction is which / which way to adjust it?
							// And shouldn't the option behave opposite? I think we have pitch yaw and roll all reversed from standard aviation definitions.
							// Since it's opposite, even though it's technically yaw (angle units), it's easier to think of as moving the cursor.
							// Hence I've renamed the setting.
							// A later update might change the definitions and include a settings file format upgrade step.
							// description: t("settings.headTilt.horizontalOffset.description.alt1", { defaultValue: "Adjusts the center position of horizontal head tilt. Not recommended. Move the camera instead if possible." }),
							// description: t("settings.headTilt.horizontalOffset.description.alt2", { defaultValue: "Adjusts the center position of horizontal head tilt. This horizontal offset is not recommended. Move the camera instead if possible." }),
							// TODO: should this say "horizontal" in the (main part of the) description?
							description: t("settings.headTilt.horizontalOffset.description", {
								defaultValue: `Adjusts the position of the cursor when the camera sees the head facing straight ahead.
⚠️ This horizontal offset is not recommended. Move the camera instead if possible. 📷` }),
						},
						{
							// label: "Vertical tilt offset",
							label: t("settings.headTilt.verticalOffset.label", { defaultValue: "Vertical cursor offset" }),
							className: "tracky-mouse-head-tilt-pitch-offset",
							key: "headTiltPitchOffset",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: -30,
							max: 30,
							default: 2.5,
							labels: {
								min: t("settings.shared.directionDown", { defaultValue: "Down" }),
								max: t("settings.shared.directionUp", { defaultValue: "Up" }),
							},
							// description: t("settings.headTilt.verticalOffset.description.alt1", { defaultValue: "Adjusts the center position of vertical head tilt." }),
							description: t("settings.headTilt.verticalOffset.description", { defaultValue: "Adjusts the position of the cursor when the camera sees the head facing straight ahead." }),
						},
					],
				},
			],
		},

		// Only dwell clicking is supported by the web library right now.
		// Currently it's a separate API (TrackyMouse.initDwellClicking)
		// TODO: bring more of desktop app functionality into core
		// https://github.com/1j01/tracky-mouse/issues/72

		// Also, the "Swap mouse buttons" setting is likely not useful for
		// web apps embedding Tracky Mouse and designed for head trackers,
		// since it necessitates mode switching for dwell clicker usage,
		// so it may make sense to hide (or not) even if it is supported there in the future.
		// The main point of this option is to counteract the system-level mouse button setting,
		// which awkwardly affects what mouse button serenade-driver sends; this doesn't affect the web version.
		{
			type: "group",
			label: t("settings.sections.clicking.label", { defaultValue: "Clicking" }),
			settings: [
				{
					label: t("settings.clickingMode.label", { defaultValue: "Clicking mode:" }), // TODO: ":"?
					className: "tracky-mouse-clicking-mode",
					key: "clickingMode",
					type: "dropdown",
					options: [
						{ value: "dwell", label: t("settings.clickingMode.dwell.label", { defaultValue: "Dwell to click" }), description: t("settings.clickingMode.dwell.description", { defaultValue: "Hold the cursor in place for a short time to click." }) },
						{ value: "blink", label: t("settings.clickingMode.wink.label", { defaultValue: "Wink to click" }), description: t("settings.clickingMode.wink.description", { defaultValue: "Close one eye to click. Left eye for left click, right eye for right click." }) },
						// TODO: clarify that ooh works better than ah
						// "open wide" refers to height, but could be misinterpreted as opposite advice - a wide mouth shape when narrow works better
						// "open wide" is also perhaps unnecessary considering detection is improved... but who knows. maybe someone will try opening their mouth only slightly and expect it to work
						// Some people may understand "tall and narrow" better than "ooh rather than ah" and visa-versa
						{ value: "open-mouth-simple", label: t("settings.clickingMode.openMouthSimple.label", { defaultValue: "Open mouth to click (simple)" }), description: t("settings.clickingMode.openMouthSimple.description", { defaultValue: "Open your mouth wide to click. At least one eye must be open to click." }) },
						{ value: "open-mouth-ignoring-eyes", label: t("settings.clickingMode.openMouthIgnoringEyes.label", { defaultValue: "Open mouth to click (ignoring eyes)" }), description: t("settings.clickingMode.openMouthIgnoringEyes.description", { defaultValue: "Open your mouth wide to click. Eye state is ignored." }) },
						{ value: "open-mouth", label: t("settings.clickingMode.openMouthWithEyeModifiers.label", { defaultValue: "Open mouth to click (with eye modifiers)" }), description: t("settings.clickingMode.openMouthWithEyeModifiers.description", { defaultValue: "Open your mouth wide to click. If left eye is closed, it's a right click; if right eye is closed, it's a middle click." }) },
						{ value: "off", label: t("settings.clickingMode.off.label", { defaultValue: "Off" }), description: t("settings.clickingMode.off.description", { defaultValue: "Disable clicking. Use with an external switch or programs that provide their own dwell clicking." }) },
					],
					default: "dwell",
					visible: () => isDesktopApp || clickingModeSupported,
					description: t("settings.clickingMode.description", { defaultValue: "Choose how to perform mouse clicks." }),
				},
				{
					// on Windows, currently, when buttons are swapped at the system level, it affects serenade-driver's click()
					// "swap" is purposefully generic language so we don't have to know what system-level setting is
					// (also this may be seen as a weirdly named/designed option for right-clicking with the dwell clicker)
					label: t("settings.swapMouseButtons.label", { defaultValue: "Swap mouse buttons" }),
					className: "tracky-mouse-swap-mouse-buttons",
					key: "swapMouseButtons",
					type: "checkbox",
					default: false,
					visible: () => isDesktopApp,
					description: t("settings.swapMouseButtons.description", {
						defaultValue: `Switches the left and right mouse buttons.
Useful if your system's mouse buttons are swapped.
Could also be used to right click with the dwell clicker in a pinch.` }),
				},

				// This setting could called "click stabilization", "drag delay", "delay before dragging", "click drag delay", "drag prevention", etc.
				// with slider labels "Easy to click -> Easy to drag" or "Easier to click -> Easier to drag" or "Short -> Long"
				// This could generalize into "never allow dragging" at the extreme, if it's special cased to jump to infinity
				// at the end of the slider, although you shouldn't need to do that to effectively avoid dragging when trying to click,
				// and it might complicate the design of the slider labeling.
				{
					label: t("settings.delayBeforeDragging.label", { defaultValue: "Delay before dragging" }),
					className: "tracky-mouse-delay-before-dragging",
					key: "delayBeforeDragging",
					type: "slider",
					min: 0,
					max: 1000,
					labels: {
						min: t("settings.delayBeforeDragging.sliderMin", { defaultValue: "Easy to drag" }),
						max: t("settings.delayBeforeDragging.sliderMax", { defaultValue: "Easy to click" }),
					},
					default: 800,
					visible: () => isDesktopApp || clickingModeSupported,
					disabled: () => s.clickingMode === "off" || s.clickingMode === "dwell",
					// description: t("settings.delayBeforeDragging.description.alt1", { defaultValue: "Locks mouse movement during the start of a click to prevent accidental dragging." }),
					// Throwing a // in here so it's not detected by i18next-cli, whereas the others are allowed
					// simply because it wasn't previously detected and translated
					// due to being both commented out and multiline (though multiline and commented out t() calls are separately supported)
					// description: t//("settings.delayBeforeDragging.description.alt2", { defaultValue: `Prevents mouse movement for the specified time after a click starts.
					// You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.` }),
					description: t("settings.delayBeforeDragging.description", {
						defaultValue: `Locks mouse movement for the given duration during the start of a click.
You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.` }),
				},
			],
		},
		{
			type: "group",
			label: t("settings.sections.video.label", { defaultValue: "Video" }),
			settings: [
				{
					label: t("settings.cameraSource.label", { defaultValue: "Camera source" }),
					className: "tracky-mouse-camera-select",
					key: "cameraDeviceId",
					handleSettingChange: () => {
						TrackyMouse.useCamera();
					},
					type: "dropdown",
					options: [
						{ value: "", label: t("settings.cameraSource.defaultCamera", { defaultValue: "Default" }) },
					],
					default: "",
					// description: t("settings.cameraSource.description.alt1", { defaultValue: "Select which camera to use for head tracking." }),
					description: t("settings.cameraSource.description", { defaultValue: "Selects which camera is used for head tracking." }),
				},
				// TODO: move this inline with the camera source dropdown?
				{
					label: t("settings.openCameraSettings.label", { defaultValue: "Open Camera Settings" }),
					className: "tracky-mouse-open-camera-settings",
					key: "openCameraSettings",
					type: "button",
					visible: () => isDesktopApp,
					onClick: async () => {
						function showToast(message) {
							const toast = document.createElement("div");
							toast.className = "tracky-mouse-toast";
							toast.textContent = message;
							document.body.appendChild(toast);
							setTimeout(() => {
								toast.remove();
							}, 5000);
						}

						let knownCameras = {};
						try {
							knownCameras = JSON.parse(localStorage.getItem("tracky-mouse-known-cameras")) || {};
						} catch (error) {
							showToast(t("openCameraSettings.errors.sharedHeading", { defaultValue: "Failed to open camera settings:" }) + "\n" + t("openCameraSettings.errors.parseKnownCameras", { defaultValue: "Failed to parse known cameras from localStorage:" }) + "\n" + error.name + ": " + error.message);
							return;
						}

						const activeStream = cameraVideo.srcObject;
						const activeDeviceId = activeStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
						const selectedDeviceName = knownCameras[activeDeviceId]?.name || t("settings.cameraSource.defaultCamera", { defaultValue: "Default" });

						try {
							const result = await window.electronAPI.openCameraSettings(selectedDeviceName);
							if (result?.error) {
								showToast(t("openCameraSettings.errors.sharedHeading", { defaultValue: "Failed to open camera settings:" }) + "\n" + result.error);
							}
						} catch (error) {
							showToast(t("openCameraSettings.errors.sharedHeading", { defaultValue: "Failed to open camera settings:" }) + "\n" + error.name + ": " + error.message);
						}
					},
					// description: t("settings.openCameraSettings.description.alt1", { defaultValue: "Open your camera's system settings window to adjust properties like brightness and contrast." }),
					// description: t("settings.openCameraSettings.description.alt2", { defaultValue: "Opens the system settings window for your camera to adjust properties like auto-focus and auto-exposure." }),
					description: t("settings.openCameraSettings.description", { defaultValue: "Opens the system settings dialog for the selected camera, to adjust properties like auto-focus and auto-exposure." }),
				},
				// TODO: try moving this to the corner of the camera view, so it's clearer it applies only to the camera view
				{
					label: t("settings.mirror.label", { defaultValue: "Mirror" }),
					className: "tracky-mouse-mirror",
					key: "mirror",
					type: "checkbox",
					default: true,
					description: t("settings.mirror.description", { defaultValue: "Mirrors the camera view horizontally." }),
				},
			]
		},
		{
			type: "group",
			label: t("settings.sections.general.label", { defaultValue: "General" }),
			settings: [
				{
					label: t("settings.soundEffects.label", { defaultValue: "Sound effects" }),
					className: "tracky-mouse-sound-effects",
					key: "soundEffects",
					type: "checkbox",
					default: true,
					afterInitialLoad: () => {
						setAudioEnabled(s.soundEffects);
					},
					handleSettingChange: () => {
						setAudioEnabled(s.soundEffects);
					},
					description: t("settings.soundEffects.description", { defaultValue: "Plays sounds when you click." }),
				},
				// opposite, "Start paused", might be clearer, especially if I add a "pause" button
				{
					label: t("settings.startEnabled.label", { defaultValue: "Start enabled" }),
					className: "tracky-mouse-start-enabled",
					key: "startEnabled",
					afterInitialLoad: () => { // TODO: does this hook make sense? right now it's the only usage. could this code not just be called later?
						setPaused(!s.startEnabled);
					},
					type: "checkbox",
					default: false,
					description: t("settings.startEnabled.description", { defaultValue: "If enabled, Tracky Mouse will start controlling the cursor as soon as it's launched." }),
					// description: t("settings.startEnabled.description.alt1", { defaultValue: "Makes Tracky Mouse active when launched. Otherwise, you can start it manually when you're ready." }),
					// description: t("settings.startEnabled.description.alt2", { defaultValue: "Makes Tracky Mouse active as soon as it's launched." }),
					// description: t("settings.startEnabled.description.alt3", { defaultValue: "Automatically starts Tracky Mouse as soon as it's run." }),
				},
				{
					// For "experimental" label:
					// - I'm preferring language that doesn't assume a new build is coming soon, fixing everything
					// - I considered adding "⚠︎" but it feels a little too alarming
					// label: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"Planned refinements include: visual and auditory feedback, improved detection accuracy, and separate settings for durations to toggle on and off.\">experimental</span>)",
					// label: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"• Missing visual and auditory feedback.\n• Missing settings for duration(s) to toggle on and off.\n• Affected by false positive blink detections, especially when looking downward.\">Experimental</span>)",
					// label: t("settings.closeEyesToToggle.label", { defaultValue: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"• There is currently no visual or auditory feedback.\n• There are no settings for duration(s) to toggle on and off.\n• It is affected by false positive blink detections, especially when looking downward.\">Experimental</span>)" }),
					label: t("settings.closeEyesToToggle.label", { defaultValue: "Close eyes to start/stop" }),
					className: "tracky-mouse-close-eyes-to-toggle",
					key: "closeEyesToToggle",
					type: "checkbox",
					default: false,
					description: t("settings.closeEyesToToggle.description", { defaultValue: "If enabled, you can start or stop mouse control by holding both your eyes shut for a few seconds." }),
				},
				{
					label: t("settings.runAtLogin.label", { defaultValue: "Run at login" }),
					className: "tracky-mouse-run-at-login",
					key: "runAtLogin",
					type: "checkbox",
					default: false,
					visible: () => isDesktopApp,
					description: t("settings.runAtLogin.description", { defaultValue: "If enabled, Tracky Mouse will automatically start when you log into your computer." }),
					// description: t("settings.runAtLogin.description.alt1", { defaultValue: "Makes Tracky Mouse start automatically when you log into your computer." }),
				},
				{
					label: t("settings.checkForUpdates.label", { defaultValue: "Check for updates" }),
					className: "tracky-mouse-check-for-updates",
					key: "checkForUpdates",
					type: "checkbox",
					default: true,
					visible: () => isDesktopApp,
					description: t("settings.checkForUpdates.description", { defaultValue: "If enabled, Tracky Mouse will automatically check for updates when it starts." }),
					// description: t("settings.checkForUpdates.description.alt1", { defaultValue: "Notifies you of new versions of Tracky Mouse." }),
					// description: t("settings.checkForUpdates.description.alt2", { defaultValue: "Notifies you when a new version of Tracky Mouse is available." }),
				},
				{
					label: t("settings.language.label", { defaultValue: "Language" }),
					className: "tracky-mouse-language",
					key: "language",
					type: "dropdown",
					options: availableLanguages.map(lang => ({ value: lang, label: `${getLanguageFlagEmoji(lang)} ${languageNames[lang]?.[1]?.[0] || lang} (${languageNames[lang]?.[0]?.[0] || "?"})` })),
					default: locale,
					handleSettingChange: () => {
						// console.trace("handleSettingChange for language setting");
						// HACK: update localStorage because it's what's used to determine the language
						// This is needed for the desktop app which otherwise saves to a file not localStorage
						try {
							localStorage.setItem("tracky-mouse-settings", JSON.stringify(serializeSettings()));
						} catch (error) {
							console.error("Error saving options to localStorage:", error);
							return;
						}
						reinit();
					},
					description: t("settings.language.description", { defaultValue: "Select the language for the Tracky Mouse interface." }),
					// description: t("settings.language.description.alt1", { defaultValue: "Changes the language Tracky Mouse is displayed in." }),
				},
			],
		},
	];
	return settingsCategories;
}

export function traverseSettings(settings, callback, parentGroup = null) {
	for (const setting of settings) {
		callback(setting, parentGroup);
		if (setting.type === "group") {
			traverseSettings(setting.settings, callback, setting);
		}
	}
}
