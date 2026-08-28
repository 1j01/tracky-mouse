/* global Stats, clm, faceLandmarksDetection, OneEuroFilter */

import { initAudio, playSound, setAudioEnabled, SleepSweep } from "./audio.js";
import { MESH_ANNOTATIONS } from "./constants.js";
import { initDwellClicking } from "./dwell-clicker.js";
import { curateTrackedPointsWithClmtrackr, curateTrackedPointsWithFacemesh } from "./face-hotspots.js";
import { detectGestures } from "./gestures.js";
import { initScreenOverlay } from "./hud.js";
import { availableLanguages, isLocaleRTL } from "./languages.js";
import { PointTracker } from "./point-tracker.js";
import { initSettingsUI } from "./settings-ui.js";
import { getSettingsCategories, traverseSettings } from "./settings.js";

export const TrackyMouse = {
	dependenciesRoot: new URL("..", import.meta.url).href.replace(/\/+$/, ""),
	silencedWarnings: [],
};

// Deprecation notice for `TrackyMouse.dependenciesRoot`
let _dependenciesRoot = TrackyMouse.dependenciesRoot;
Object.defineProperty(TrackyMouse, "dependenciesRoot", {
	set(value) {
		if (!TrackyMouse.silencedWarnings.includes("dependenciesRoot-deprecation")) {
			console.warn("TrackyMouse.dependenciesRoot is deprecated, and no longer needs to be set. You can remove it from your code. Dependencies will be loaded relative to the tracky-mouse.js module.");
			// Could use silencedWarnings to avoid showing the same warning multiple times
			// but mainly I'm adding it for consumers to silence the warning if they want to.
			// TrackyMouse.silencedWarnings.push("dependenciesRoot-deprecation");
		}
		_dependenciesRoot = value.replace(/\/+$/, "");
	},
	get() {
		return _dependenciesRoot;
	},
});

TrackyMouse.loadDependencies = function ({ statsJs = false } = {}) {
	const loadScript = src => {
		return new Promise((resolve, reject) => {
			// This wouldn't wait for them to load
			// for (const script of document.scripts) {
			// 	if (script.src.includes(src)) {
			// 		resolve();
			// 		return;
			// 	}
			// }
			const script = document.createElement('script');
			script.type = 'text/javascript';
			script.onload = resolve;
			script.onerror = reject;
			script.src = src;
			document.head.append(script);
		});
	};
	const scriptFiles = [
		`${TrackyMouse.dependenciesRoot}/lib/no-eval.js`, // generated with eval-is-evil.html, this instruments clmtrackr.js so I don't need unsafe-eval in the CSP
		`${TrackyMouse.dependenciesRoot}/lib/clmtrackr.js`,
		`${TrackyMouse.dependenciesRoot}/lib/face_mesh/face_mesh.js`,
		`${TrackyMouse.dependenciesRoot}/lib/OneEuroFilter.js`,
	];
	// face-landmarks-detection.min.js depends on face_mesh.js
	// avoid sporadic "TypeError: o.Facemesh is not a constructor" by loading face-landmarks-detection after face_mesh.js
	// TODO: preload in parallel?
	const moreScriptFiles = [
		`${TrackyMouse.dependenciesRoot}/lib/face-landmarks-detection.min.js`,
	];
	if (statsJs) {
		scriptFiles.push(`${TrackyMouse.dependenciesRoot}/lib/stats.js`);
	}
	return Promise.all(scriptFiles.map(loadScript)).then(() => {
		return Promise.all(moreScriptFiles.map(loadScript));
	});
};

TrackyMouse.initDwellClicking = function (config) {
	return initDwellClicking(config);
};

TrackyMouse._initInner = function (div, initOptions, reinit) {

	const {
		statsJs = false,
		// Unstable
		updateInputFeedback = window.electronAPI?.updateInputFeedback,
		// Unstable
		setMouseButtonState = window.electronAPI?.setMouseButtonState,
		// Unstable
		notifyToggleState = window.electronAPI?.notifyToggleState,
		// Unstable
		handleSettingsUpdate,
		// Unstable
		clickingModeSupported = false,
		// TODO: manage all of electronAPI similarly? well, setOptions is already a function in scope here,
		// and it's not like we want to expose all electronAPI as part of the public API necessarily
		// Could group things under an "unstable" object, or ideally, design nice APIs for everything.
	} = initOptions;

	/** @type {SleepSweep | null} */
	let sleepSweep = null;

	try {
		initAudio();
		sleepSweep = new SleepSweep();
	} catch (e) {
		console.warn("Failed to initialize audio support, click sounds will be disabled:", e);
	}

	const isDesktopApp = !!window.electronAPI;

	let translations = {};
	let locale = navigator.language || "en";
	// Transform en-US to en, etc.
	// We don't support variants yet
	if (locale.includes("-")) {
		locale = locale.split("-")[0];
	}
	// Fallback to a valid dropdown value for unsupported locales
	if (!availableLanguages.includes(locale)) {
		locale = "en";
	}
	try {
		// Load settings early so that they can be used to define settings (among other things)
		// It's a bit hacky to load them twice but yeah
		// (Actually in the desktop app it's even more hacky because I
		// added code in electron-app.html to load the settings via the electron API
		// and populate localStorage so that this code will work)
		const settingsJSON = localStorage.getItem("tracky-mouse-settings");
		if (settingsJSON) {
			locale = JSON.parse(settingsJSON)?.globalSettings?.language || locale;
		}
		if (locale !== "en") {
			// synchronous XHR baby!
			const request = new XMLHttpRequest();
			request.open("GET", `${TrackyMouse.dependenciesRoot}/locales/${locale}/translation.json`, false);
			request.send(null);
			if (request.status === 200) {
				translations = JSON.parse(request.responseText);
			} else {
				console.warn(`Could not load translations for locale ${locale} (status ${request.status})`);
			}
		}
	} catch (e) {
		console.warn("Could not load translations for TrackyMouse UI:", e);
	}
	const isRTL = isLocaleRTL(locale);
	const t = (key, options = {}) => translations[key] ?? options.defaultValue ?? key;
	// console.trace("Initializing UI with locale", locale);

	let uiContainer = div || document.createElement("div");
	uiContainer.classList.add("tracky-mouse-ui");
	uiContainer.classList.toggle("tracky-mouse-rtl", isRTL);
	uiContainer.dir = isRTL ? "rtl" : "ltr";
	uiContainer.innerHTML = `
		<div class="tracky-mouse-controls">
			<button class="tracky-mouse-start-stop-button" aria-pressed="false" aria-keyshortcuts="F9">${t("ui.startStopButton.start", { defaultValue: "Start" })}</button>
		</div>
		<div class="tracky-mouse-camera-area">
			<div class="tracky-mouse-canvas-container">
				<div class="tracky-mouse-canvas-overlay">
					<button class="tracky-mouse-use-camera-button">${t("ui.camera.allowAccess", { defaultValue: "Allow Camera Access" })}</button>
					<!--<button class="tracky-mouse-use-camera-button">${t("ui.camera.useMyCamera", { defaultValue: "Use my camera" })}</button>-->
					<button class="tracky-mouse-use-demo-footage-button" hidden>${t("ui.camera.useDemoFootage", { defaultValue: "Use demo footage" })}</button>
					<div class="tracky-mouse-error-message" role="alert" hidden></div>
				</div>
				<canvas class="tracky-mouse-canvas"></canvas>
			</div>
		</div>
		<p class="tracky-mouse-desktop-app-download-message">
			${t("ui.desktopAppPromo.message", { defaultValue: 'You can control your entire computer with the <a href="https://trackymouse.js.org/">TrackyMouse</a> desktop app.' })}
		</p>
	`;
	if (!div) {
		document.body.appendChild(uiContainer);
	}
	let startStopButton = uiContainer.querySelector(".tracky-mouse-start-stop-button");
	let useCameraButton = uiContainer.querySelector(".tracky-mouse-use-camera-button");
	let useDemoFootageButton = uiContainer.querySelector(".tracky-mouse-use-demo-footage-button");
	let errorMessage = uiContainer.querySelector(".tracky-mouse-error-message");
	let canvasContainer = uiContainer.querySelector('.tracky-mouse-canvas-container');
	let desktopAppDownloadMessage = uiContainer.querySelector('.tracky-mouse-desktop-app-download-message');

	let lastShownErrorDetails = null;
	function showError(message, error, { warningIcon = true, errorClass = "other" } = {}) {
		const alreadyShown = !errorMessage.hidden && lastShownErrorDetails?.message === message && lastShownErrorDetails?.error?.name === error?.name && lastShownErrorDetails?.error?.message === error?.message;
		if (alreadyShown) {
			// Play CSS animation to indicate repeated errors
			// but not if they're occurring constantly
			// Note: for constant errors, with this scheme, it may animate
			// when returning to the tab due to timer throttling, or due to lag.
			if (performance.now() > lastShownErrorDetails.time + 100) {
				errorMessage.style.animation = "none";
				if (alreadyShown) {
					void errorMessage.offsetWidth; // trigger reflow to allow restarting animation
					errorMessage.style.animation = "";
				}
			}
		} else {
			if (warningIcon) {
				errorMessage.textContent = `${t("common.warningIcon", { defaultValue: "⚠️" })} ${message}`;
			} else {
				errorMessage.textContent = message;
			}
			if (error) {
				const pre = document.createElement("pre");
				pre.textContent = error.name + ": " + error.message;
				errorMessage.appendChild(pre);
			}
			errorMessage.hidden = false;
		}
		lastShownErrorDetails = { message, error, time: performance.now(), errorClass };
	}

	const cameraVideo = document.createElement('video');
	cameraVideo.setAttribute('playsinline', ''); // required to work in iOS 11 & up

	// Settings (initialized later; defaults are defined in settingsCategories)
	const s = {};

	const settingsCategories = getSettingsCategories({
		t,
		locale,
		serializeSettings,
		reinit,
		s,
		isDesktopApp,
		clickingModeSupported,
		cameraVideo,
		setPaused: (value) => {
			paused = value;
		},
	});

	const { updateDisabledStates, populateCameraList, disposeSettingsUI } = initSettingsUI({
		settingsCategories,
		uiContainer,
		t,
		s,
		getSetOptionsFunction: () => setOptions,
	});

	if (window.electronAPI) {
		// Hide the desktop app download message if we're in the desktop app
		// Might be good to also hide it, or change it, when on a mobile device
		desktopAppDownloadMessage.hidden = true;
	}

	let canvas = uiContainer.querySelector(".tracky-mouse-canvas");
	let ctx = canvas.getContext('2d', { willReadFrequently: true });

	let debugEyeCanvas = document.createElement("canvas");
	debugEyeCanvas.className = "tracky-mouse-debug-eye-canvas";
	debugEyeCanvas.style.display = "none";
	uiContainer.querySelector(".tracky-mouse-camera-area").appendChild(debugEyeCanvas);
	let debugEyeCtx = debugEyeCanvas.getContext('2d');

	let pointerEl = document.createElement('div');
	pointerEl.className = "tracky-mouse-pointer";
	pointerEl.style.display = "none";
	document.body.appendChild(pointerEl);

	let stats;
	if (statsJs) {
		stats = new Stats();
		stats.domElement.style.position = 'fixed';
		stats.domElement.style.top = '0px';
		stats.domElement.style.right = '0px';
		stats.domElement.style.left = '';
		document.body.appendChild(stats.domElement);
	}

	// Debug flags (not shown in the UI; could become Advanced Settings in the future)
	let debugAcceleration = false;
	let showDebugText = false;
	let showDebugEyeZoom = false;
	let showDebugHeadTilt = false;
	let showDebugRegionFilter = false;

	// Constants (could become Advanced Settings in the future)
	let defaultWidth = 640;
	let defaultHeight = 480;
	let maxPoints = 1000;
	let faceScoreThreshold = 0.5;
	let facemeshOptions = {
		maxContinuousChecks: 5,
		detectionConfidence: 0.9,
		maxFaces: 1,
		iouThreshold: 0.3,
		scoreThreshold: 0.75
	};
	let useFacemesh = true;
	let sleepGestureEyesClosedDuration = 2000;
	// maybe should be based on size of head in view?
	const pruningGridSize = 5;

	const joystickMaxSpeed = 0.5; // pixels per millisecond
	const joystickDistanceToSpeedExponent = 1;
	const joystickTimeToSpeedExponent = 1.2;
	const joystickSpeedRampTime = 2500; // milliseconds
	const joystickMinSpeedThreshold = 0.3; // fraction of joystickMaxMagnitude; AKA deadzone
	const joystickMaxSpeedThreshold = 1; // fraction of joystickMaxMagnitude; AKA live-zone?
	const joystickMaxMagnitude = 0.2;
	const joystickAngleHysteresis = 0.3; // fraction of d-pad direction arc beyond the arc where it will switch to a different direction

	// Head tracking and facial gesture state
	// ## Clmtrackr state
	let face;
	let faceScore = 0;
	let faceConvergence = 0;
	// let faceConvergenceThreshold = 50;
	let pointsBasedOnFaceScore = 0;
	// ## Facemesh state
	let detector;
	let currentCameraImageData;
	let facemeshLoaded = false;
	let facemeshFirstEstimation = true;
	let facemeshEstimating = false;
	let facemeshRejectNext = 0;
	let facemeshPrediction;
	let facemeshEstimateFaces;
	let faceInViewConfidenceThreshold = 0.7;
	let pointsBasedOnFaceInViewConfidence = 0;
	let cameraFramesSinceFacemeshUpdate = [];
	let blinkInfo;
	let mouthInfo;
	let headTilt = { pitch: 0, yaw: 0, roll: 0 };
	let headTiltFilters = { pitch: null, yaw: null, roll: null };
	let sleepGestureProgress = 0;
	// ## State related to switching between head trackers
	let useClmTracking = true;
	let showClmTracking = useClmTracking;
	let fallbackTimeoutID;

	// Mouse state
	let mouseX = 0;
	let mouseY = 0;
	let buttonStates = {
		left: false,
		right: false,
		middle: false,
	};
	let mouseButtonUntilMouthCloses = -1;
	let virtualJoystickX = 0; // used for joystick/d-pad movement modes
	let virtualJoystickY = 0;
	let virtualDPadAngle = Infinity; // used for d-pad movement modes
	let virtualJoystickSpeedRampStartTime = performance.now(); // used for joystick/d-pad movement modes
	let virtualJoystickInfo;
	let lastMouseDownTime = -Infinity;
	let mouseNeedsInitPos = true;

	// Virtual display bounds cache (Electron only); covers all connected monitors.
	let virtualDisplayBounds = null;
	if (window.electronAPI?.getVirtualDisplayBounds) {
		window.electronAPI.getVirtualDisplayBounds().then((bounds) => {
			virtualDisplayBounds = bounds;
		});
		window.electronAPI.onVirtualDisplayBoundsChanged?.((bounds) => {
			virtualDisplayBounds = bounds;
			mouseNeedsInitPos = true;
		});
	}

	// Other state
	let paused = true;
	let pointTracker;


	const initFacemesh = async () => {
		if (detector) {
			detector.dispose();
		}
		facemeshEstimating = false;
		facemeshFirstEstimation = true;
		facemeshLoaded = false;
		const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
		const detectorConfig = {
			runtime: 'mediapipe',
			solutionPath: `${TrackyMouse.dependenciesRoot}/lib/face_mesh`,
			refineLandmarks: true,
		};

		try {
			detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
			if (lastShownErrorDetails?.errorClass === "faceLandmarksDetection.createDetector") {
				errorMessage.hidden = true;
			}
		} catch (error) {
			detector = null;
			console.error("Failed to create facemesh detector:", error);
			showError(t("faceDetectorInitError", { defaultValue: "Failed to create face detector" }), error, { errorClass: "faceLandmarksDetection.createDetector" });
		}

		facemeshLoaded = true;
		let loggedDetectorError = false;
		facemeshEstimateFaces = async () => {
			const imageData = currentCameraImageData;//getCameraImageData();
			if (!imageData) {
				return [];
			}
			try {
				const faces = await detector.estimateFaces(imageData, { flipHorizontal: false });
				if (!faces) {
					console.warn("faces ===", faces);
					return [];
				}
				return faces;
			} catch (error) {
				if (!loggedDetectorError) {
					console.error("Facemesh estimation failed:", error);
					loggedDetectorError = true;
				}
				try {
					detector?.dispose();
				} catch (disposeError) {
					console.error("Failed to dispose facemesh detector after estimation error:", disposeError);
				}
				detector = null;
				showError(t("faceDetectorError", { defaultValue: "Face detector error" }), error);
			}
			return [];
		};

	};

	if (useFacemesh) {
		initFacemesh();
	}

	function deserializeSettings(settings, initialLoad = false) {
		// TODO: DRY with deserializeSettings in electron-main.js
		for (const category of settingsCategories) {
			traverseSettings(category.settings, (setting) => {
				setting._load?.(settings, initialLoad);
			});
		}
		setAudioEnabled(s.soundEffects);

		// Now that all settings are loaded, update disabled states
		updateDisabledStates();

		// Unstable hook
		handleSettingsUpdate?.(settings);
	}
	const formatVersion = 1;
	const formatName = "tracky-mouse-settings";
	function serializeSettings() {
		// TODO: DRY with serializeSettings in electron-main.js
		// The important part is done (don't need to list every setting here - or there),
		// but we could still switch to using IPC for saving/loading serialized settings
		// eliminating the duplicate format handling, which may become more complex over time.
		// The main process will still want to know about _some_ settings, and this shouldn't go through the serialization,
		// but that can remain using the existing IPC calls while we add new ones dealing with serialized settings.
		// (So I guess this is really a todo for the electron app; maybe this sort of detailed comment would make more sense there.)
		return {
			formatVersion,
			formatName,
			globalSettings: s,
			// profiles: [],
		};
	};
	const setOptions = (options) => {
		if (window.electronAPI) {
			window.electronAPI.setOptions(options);
		} else {
			try {
				localStorage.setItem("tracky-mouse-settings", JSON.stringify(serializeSettings(), null, "\t"));
			} catch (e) {
				console.error(e);
			}
		}
		// Unstable hook
		handleSettingsUpdate?.(options);
	};
	const loadOptions = async (initialLoad = false) => {
		// Desktop app: start from any saved settings in the main process,
		// then, on first load, push the renderer's canonical defaults back
		// so the main process has the same effective settings (and can
		// correctly drive features like dwell clicking on first run).
		// Web demo: similarly needs canonical defaults pushed to
		// correctly enable dwell clicking on first run,
		// now that it supports multiple clicking modes.
		// General API usage: does not yet support multiple clicking modes
		// (there's a lot of glue code in the demo)
		// but we only call handleSettingsUpdate if it exists.
		let stored;
		if (window.electronAPI) {
			stored = await window.electronAPI.getOptions();
		} else {
			try {
				if (localStorage.getItem("tracky-mouse-settings")) {
					stored = JSON.parse(localStorage.getItem("tracky-mouse-settings"));
				}
			} catch (e) {
				console.error(e);
				return;
			}
		}
		if (stored) {
			deserializeSettings(stored, initialLoad);
		} else {
			// HACK: ensure handleInitialLoad is called even for first run
			// Combined with the below, this feels very redundant, and I'd like to
			// move to a subscription-based pattern, more of a formal "settings store", something like that.
			// This is currently necessary for sound effects to work on the first run of the web demo.
			deserializeSettings(serializeSettings(), initialLoad);
		}
		if (initialLoad && (!stored || !stored.globalSettings || Object.keys(stored.globalSettings).length === 0)) {
			// We could just call setOptions in both cases,
			// but do we want to save to localStorage initially? Maybe not.
			if (window.electronAPI) {
				setOptions(serializeSettings()); // (includes handleSettingsUpdate)
			} else {
				handleSettingsUpdate?.(serializeSettings());
			}
		}
	};

	paused = !s.startEnabled;

	const settingsLoadedPromise = loadOptions(true);

	// Don't use WebGL because clmTracker is our fallback! It's also not much slower than with WebGL.
	let clmTracker = new clm.tracker({ useWebGL: false });
	clmTracker.init();
	let clmTrackingStarted = false;

	const stopCameraStream = () => {
		if (cameraVideo.srcObject) {
			for (const track of cameraVideo.srcObject.getTracks()) {
				track.stop();
			}
		}
		cameraVideo.srcObject = null;
	};

	const reset = () => {
		stopCameraStream();
		clmTrackingStarted = false;
		cameraFramesSinceFacemeshUpdate.length = 0;
		if (facemeshPrediction) {
			// facemesh has a setting maxContinuousChecks that determines "How many frames to go without running
			// the bounding box detector. Only relevant if maxFaces > 1. Defaults to 5."
			facemeshRejectNext = facemeshOptions.maxContinuousChecks;
		}
		facemeshPrediction = null;
		useClmTracking = true;
		showClmTracking = true;
		pointsBasedOnFaceScore = 0;
		faceScore = 0;
		faceConvergence = 0;
		sleepGestureProgress = 0;
		updateStartStopButton();
	};

	// Handle monkey-patched alert() replacement in face-landmarks-detection.min.js
	// (Hm, could make it throw instead. Then we wouldn't need this.)
	window._TrackyMouse_faceLandmarksDetectionAlert = (message) => {
		// TODO: i18n (it's just one message; we could check for the string (or not) and translate it)
		// const isContextCreationMessage = message === "Failed to create WebGL canvas context when passing video frame.";
		errorMessage.textContent = `${t("common.warningIcon", { defaultValue: "⚠️" })} ${message}`;
		errorMessage.hidden = false;
	};

	const cameraAccessSlowWarningDelayMS = 5000;
	let cameraAccessSlowWarningTimeoutID;
	useCameraButton.onclick = TrackyMouse.useCamera = async (optionsOrEvent = {}) => {
		// Phases:
		// 1. "tryPreferredCamera"
		//    Use the configured device ID to try to access the preferred camera.
		//    If the permission has been revoked, the browser may
		//    switch to a mode where `enumerateDevices` gives FAKE data
		//    and `getUserMedia` will fail with OverconstrainedError
		//    when trying to access a real device
		//    (without even triggering a permission prompt that might
		//    lead to getting the real list of devices.)
		// 2. "justGetPermission"
		//    Request any camera in order to get camera permission
		//    in general and get real data from `enumerateDevices`
		//    in phase 3.
		//    Close the stream immediately, as it may not be the
		//    stream we want, and we can't tell, as far I know.
		//    Then populate the camera list with real data.
		// 3. "retryPreferredCamera"
		//    Now that we have a real list of devices,
		//    and are allowed to access real devices,
		//    try again with a specific device ID.
		//    If there's a match by name and not ID, we use that.
		//
		// Q: Why not get rid of phase 1? Shouldn't 2+3 handle it?
		// In Electron, closing the stream and re-requesting access
		// often gives a "camera in use" error.
		// Plus, _ideally_ phase 1 means it can connect faster in browsers.
		// However, phase 1 may only get OverconstrainedError in browsers
		// as it's implemented.
		// We could get rid of phase 1 in browsers, basically separating the flows.
		// But...
		// I wonder if revoking camera access is what changes device IDs,
		// and if device IDs changing is what gives OverconstrainedError,
		// not the "fake device list" behavior. Is it perhaps only hiding labels in that mode,
		// but separately permanently scrambling IDs as a single event?
		// If device IDs are changed, storing the new device ID to try in phase 1
		// might make phase 1 work as an optimization in browsers.
		//
		// Q: If Electron has such a problem, would it not occur in the later phases?
		// Phase 2+3 should never occur in Electron.
		// In fact, we can guard against this.
		// Although, if phase 2+3 are only entered on failure,
		// it can't really be a problem, can it?
		//
		// Q: Will this cause unnecessary prompts?
		// In the case of one existing camera, no.
		// In the case that there are multiple existing cameras,
		// and the user grants access to a different one than is configured,
		// it may cause an extra prompt.
		// In Firefox, you can choose to allow all cameras with a checkbox.
		// If you check that box, or select the matching camera before clicking Allow,
		// there should be only one prompt.
		//
		// Q: Why not use a library for this?
		// The mic-check package uses a similar approach, but seems to
		// encourage a pattern where nice error handling is applied
		// only to a "just get permission" equivalent phase,
		// whereas by using recursion or separating out the error handling
		// into a function, one can handle errors nicely always.
		// mic-check provides only the one phase, and presumably
		// is meant for a two-phase solution.
		//
		// Q: What happens if there are multiple overlapping calls to `useCamera`?
		// I don't know. TODO: test this.
		//
		// P.S. I gave a talk about this at Rubber Duck Conf 2026
		// You can view the slides here: https://websim.com/@1j01/ughaaaaaa

		await settingsLoadedPromise;

		const phase = optionsOrEvent.phase ?? "tryPreferredCamera";

		const constraints = {
			audio: false,
			video: {
				width: defaultWidth,
				height: defaultHeight,
				facingMode: "user",
			}
		};
		const deviceIdToTry = phase === "retryPreferredCamera" ?
			optionsOrEvent.retryWithCameraDeviceId :
			phase === "tryPreferredCamera" ?
				s.cameraDeviceId :
				"";
		if (deviceIdToTry) {
			delete constraints.video.facingMode;
			constraints.video.deviceId = { exact: deviceIdToTry };
		}
		clearTimeout(cameraAccessSlowWarningTimeoutID);
		errorMessage.hidden = true;
		cameraAccessSlowWarningTimeoutID = setTimeout(() => {
			errorMessage.textContent = t("video.status.accessTakingLongerThanExpected", { defaultValue: "Accessing the camera is taking longer than expected..." });
			errorMessage.hidden = false;
		}, cameraAccessSlowWarningDelayMS);
		console.log("TrackyMouse.useCamera phase", phase, "constraints", constraints);
		navigator.mediaDevices.getUserMedia(constraints).then(async (stream) => {
			clearTimeout(cameraAccessSlowWarningTimeoutID);
			if (phase === "justGetPermission") {
				for (const track of stream.getTracks()) {
					track.stop();
				}
				// This is giving me User Gesture Hinged Access and Async Authorization Asking Attempt Absorption Anxiety,
				// or "UGHAaAAAAAA" (I'm coining that term)
				// (Look I made a presentation about it: https://websim.com/@1j01/ughaaaaaa)
				const matchedCameraId = await populateCameraList();
				if (matchedCameraId) {
					TrackyMouse.useCamera({ retryWithCameraDeviceId: matchedCameraId, phase: "retryPreferredCamera" });
				} else {
					TrackyMouse.useCamera({ retryWithCameraDeviceId: "", phase: "retryPreferredCamera" });
				}
				return;
			}
			populateCameraList();
			reset();

			cameraVideo.srcObject = stream;
			useCameraButton.hidden = true;
			errorMessage.hidden = true;
		}, async (error) => {
			clearTimeout(cameraAccessSlowWarningTimeoutID);
			console.log("TrackyMouse.useCamera phase", phase, "error", error);
			if (
				phase === "tryPreferredCamera" &&
				(error.name === "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") &&
				!window.electronAPI
			) {
				TrackyMouse.useCamera({ phase: "justGetPermission" });
				return;
			}
			if (error.name == "NotFoundError" || error.name == "DevicesNotFoundError") {
				// required track is missing
				showError(t("video.errors.noCameraFound", { defaultValue: "No camera found. Please make sure you have a camera connected and enabled." }));
			} else if (error.name == "NotReadableError" || error.name == "TrackStartError") {
				// webcam is already in use
				// or: OBS Virtual Camera is present but OBS is not running with Virtual Camera started
				// TODO: enumerateDevices and give more specific message for OBS Virtual Camera case
				// (listing devices and showing only the OBS Virtual Camera would also be a good clue in itself;
				// though care should be given to make it clear it's a list with one item, with something like "(no more cameras detected)" following the list
				// or "1 camera source detected" preceding it)
				showError(t("video.errors.cameraInUse", { defaultValue: "Webcam is already in use. Please make sure you have no other programs using the camera." }));
			} else if (error.name === "AbortError") {
				// webcam is likely already in use
				// I observed AbortError in Firefox 132.0.2 but I don't know it's used exclusively for this case.
				// Update: it definitely isn't, but I can't say exactly what it means in other cases.
				// Like, it might have to do with permissions being denied outside of a user gesture (distinct from the user denying the permission)
				// I really hope that isn't the problem.
				// showError("Webcam may already be in use. Please make sure you have no other programs using the camera.");
				showError(t("video.errors.retryAfterClosingOtherPrograms", { defaultValue: "Please make sure no other programs are using the camera and try again." }));
				// A more honest/helpful message might be:
				// showError("Please try again and then make sure no other programs are using the camera and try again again.");
				// showError("Please try again before/after making sure no other programs are using the camera.");
				// if it were not to be confusing.
				// That is, one could save some time by just hitting the button to try again before trying to figure out of another program is using the camera,
				// because sometimes that's enough.
			} else if (error.name == "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") {
				// constraints cannot be satisfied by available devices

				// OverconstrainedError can be caused by `deviceId` not matching,
				// either due to the device not being present, or the ID having changed (don't ask me why that can happen but it can)
				// Note: OverconstrainedError has a `constraint` property but not in Firefox so it's not very helpful.
				if (constraints.video.deviceId?.exact) {
					// showError("The previously selected camera is not available. Please select a different camera from the dropdown and try again.");
					// showError("The previously selected camera is not available. Please mess around with Video > Camera source.");
					// showError("The previously selected camera is not available. Try changing Video > Camera source.");
					// showError("The previously selected camera is not available. Please select a camera from the \"Camera source\" dropdown in the Video settings and if it doesn't show up, it might after you select Default.");
					showError(t("video.errors.previouslySelectedUnavailable", { defaultValue: "The previously selected camera is not available. Try selecting \"Default\" for Video > Camera source, and then select a specific camera if you need to." }));
					// It's awkward but that's my best attempt at conveying how you may need to proceed
					// without complicated description of how/why the dropdown might be populated with
					// fake information until a camera stream is successfully opened.
				} else {
					showError(t("video.errors.unsupportedResolution", { defaultValue: "Webcam does not support the required resolution. Please change your settings." }));
				}
			} else if (error.name == "NotAllowedError" || error.name == "PermissionDeniedError") {
				// permission denied in browser
				showError(t("video.errors.permissionDenied", { defaultValue: "Permission denied. Please enable access to the camera." }));
			} else if (error.name == "TypeError") {
				// empty constraints object
				showError(t("video.errors.accessFailed", { defaultValue: "Something went wrong accessing the camera." }), error);
			} else {
				// other errors
				showError(t("video.errors.accessFailedRetry", { defaultValue: "Something went wrong accessing the camera. Please try again." }), error);
			}
		});
	};
	useDemoFootageButton.onclick = TrackyMouse.useDemoFootage = () => {
		reset();
		cameraVideo.src = `${TrackyMouse.dependenciesRoot}/private/demo-input-footage.webm`;
		cameraVideo.loop = true;
	};

	startStopButton.onclick = () => {
		if (!useCameraButton.hidden) {
			TrackyMouse.useCamera();
		}
		handleShortcut("toggle-tracking");
	};

	if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
		console.log('getUserMedia not supported in this browser');
	}

	canvasContainer.style.aspectRatio = `${defaultWidth} / ${defaultHeight}`;
	canvasContainer.style.setProperty('--aspect-ratio', defaultWidth / defaultHeight);

	cameraVideo.addEventListener('loadedmetadata', () => {
		cameraVideo.play();
		cameraVideo.width = cameraVideo.videoWidth;
		cameraVideo.height = cameraVideo.videoHeight;
		canvas.width = cameraVideo.videoWidth;
		canvas.height = cameraVideo.videoHeight;

		// .tracky-mouse-canvas-container needs aspect-ratio CSS property
		// so that the video can be scaled to fit the container.
		canvasContainer.style.aspectRatio = `${cameraVideo.videoWidth} / ${cameraVideo.videoHeight}`;
		canvasContainer.style.setProperty('--aspect-ratio', cameraVideo.videoWidth / cameraVideo.videoHeight);

		pointTracker = new PointTracker({ cameraVideo, maxPoints, pruningGridSize });
	});
	cameraVideo.addEventListener('play', () => {
		clmTracker.reset();
		clmTracker.initFaceDetector(cameraVideo);
		clmTrackingStarted = true;
	});
	cameraVideo.addEventListener('ended', () => {
		useCameraButton.hidden = false;
		if (!paused) {
			handleShortcut("toggle-tracking");
		}
	});
	cameraVideo.addEventListener('error', () => {
		useCameraButton.hidden = false;
		if (!paused) {
			handleShortcut("toggle-tracking");
		}
	});

	canvas.width = defaultWidth;
	canvas.height = defaultHeight;
	cameraVideo.width = defaultWidth;
	cameraVideo.height = defaultHeight;

	canvas.addEventListener('click', (event) => {
		if (!pointTracker) {
			return;
		}
		const rect = canvas.getBoundingClientRect();
		if (s.mirror) {
			pointTracker.addPoint(
				(rect.right - event.clientX) / rect.width * canvas.width,
				(event.clientY - rect.top) / rect.height * canvas.height,
			);
		} else {
			pointTracker.addPoint(
				(event.clientX - rect.left) / rect.width * canvas.width,
				(event.clientY - rect.top) / rect.height * canvas.height,
			);
		}
	});

	let lastTimestamp = -Infinity;
	function draw(update = true) {
		ctx.resetTransform(); // in case there is an error, don't flip constantly back and forth due to mirroring
		ctx.clearRect(0, 0, canvas.width, canvas.height); // in case there's no footage
		ctx.save();
		ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		currentCameraImageData = imageData;

		if (s.mirror) {
			ctx.translate(canvas.width, 0);
			ctx.scale(-1, 1);
			ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
		}

		const timestamp = performance.now();
		const deltaTime = Math.min(timestamp - lastTimestamp, 100);
		lastTimestamp = timestamp;

		sleepSweep?.setEnabled(s.closeEyesToToggle);
		sleepSweep?.update(sleepGestureProgress);

		if (!pointTracker) {
			return;
		}

		if (update) {
			if (clmTrackingStarted) {
				if (useClmTracking || showClmTracking) {
					try {
						clmTracker.track(cameraVideo);
					} catch (error) {
						console.warn("Error in clmTracker.track()", error);
						if (clmTracker.getCurrentParameters().includes(NaN)) {
							console.warn("NaNs crept in.");
						}
					}
					face = clmTracker.getCurrentPosition();
					faceScore = clmTracker.getScore();
					faceConvergence = Math.pow(clmTracker.getConvergence(), 0.5);
				}
				if (facemeshLoaded && !facemeshEstimating) {
					facemeshEstimating = true;
					// movementXSinceFacemeshUpdate = 0;
					// movementYSinceFacemeshUpdate = 0;
					cameraFramesSinceFacemeshUpdate = [];
					// If I switch virtual console desktop sessions in Ubuntu with Ctrl+Alt+F1 (and back with Ctrl+Alt+F2),
					// WebGL context is lost, which breaks facemesh (and clmTracker if useWebGL is not false)
					// Error: Size(8192) must match the product of shape 0, 0, 0
					//     at inferFromImplicitShape (tf.js:14142)
					//     at Object.reshape$3 [as kernelFunc] (tf.js:110368)
					//     at kernelFunc (tf.js:17241)
					//     at tf.js:17334
					//     at Engine.scopedRun (tf.js:17094)
					//     at Engine.runKernelFunc (tf.js:17328)
					//     at Engine.runKernel (tf.js:17171)
					//     at reshape_ (tf.js:25875)
					//     at reshape__op (tf.js:18348)
					//     at executeOp (tf.js:85396)
					// WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost

					// Note that the first estimation from facemesh often takes a while*,
					// and we don't want to continuously terminate the worker** as it's working on those first results.
					// And also, for the first estimate it hasn't actually disabled clmtrackr yet, so it's fine if it's a long timeout.
					// *Or it did, before updating the facemesh pipeline.
					// **Not using a worker for facemesh anymore...
					clearTimeout(fallbackTimeoutID);
					fallbackTimeoutID = setTimeout(() => {
						if (!useClmTracking) {
							reset();
							clmTracker.init();
							clmTracker.reset();
							clmTracker.initFaceDetector(cameraVideo);
							clmTrackingStarted = true;
							console.warn("Falling back to clmtrackr");
						}
						// If you've switched desktop sessions, it will presumably fail to get a new webgl context until you've switched back
						// Is this setInterval useful, vs just starting the worker?**
						// It probably has a faster cycle, with the code as it is now, but maybe not inherently.
						// TODO: do the extra getContext() calls add to a GPU process crash limit
						// that makes it only able to recover a couple times (outside the electron app)?
						// For electron, I set chromium flag --disable-gpu-process-crash-limit so it can recover unlimited times.
						// TODO: there's still the case of WebGL backend failing to initialize NOT due to the process crash limit,
						// where it'd be good to have it try again (maybe with exponential falloff?)
						// (I think I can move my fallbackTimeout code into/around `initFacemeshWorker` and `facemeshEstimateFaces`)

						// Note: clearTimeout/clearInterval work interchangeably
						fallbackTimeoutID = setInterval(() => {
							try {
								// TODO: attempting webgl context creation beforehand doesn't make sense without a worker
								// If it's running in the same thread, we can just try creating the detector.

								// Once we can create a webgl2 canvas...
								document.createElement("canvas").getContext("webgl2");
								clearInterval(fallbackTimeoutID);
								// It's worth trying to re-initialize [a web worker** for facemesh]...
								setTimeout(() => {
									console.warn("Re-initializing facemesh");
									initFacemesh();
									facemeshRejectNext = 1; // or more?
								}, 1000);
							} catch (error) {
								if (error.name !== "InvalidStateError") {
									throw error;
								} else {
									console.warn("Trying to recover; can't create webgl2 canvas yet...");
								}
							}
						}, 500);
					}, facemeshFirstEstimation ? 20000 : 2000);
					facemeshEstimateFaces().then((predictions) => {
						facemeshEstimating = false;
						facemeshFirstEstimation = false;

						facemeshRejectNext -= 1;
						if (facemeshRejectNext > 0) {
							return;
						}

						facemeshPrediction = predictions[0]; // undefined if no faces found

						useClmTracking = false;
						showClmTracking = false;
						clearTimeout(fallbackTimeoutID);

						if (!facemeshPrediction) {
							blinkInfo = null;
							mouthInfo = null;
							return;
						}
						facemeshPrediction.faceInViewConfidence = 0.9999; // TODO: any equivalent in new API?

						const getPoint = (index) =>
							facemeshPrediction.keypoints[index] ?
								[facemeshPrediction.keypoints[index].x, facemeshPrediction.keypoints[index].y, facemeshPrediction.keypoints[index].z] :
								undefined;

						const annotations = Object.fromEntries(Object.entries(MESH_ANNOTATIONS).map(([key, indices]) => {
							return [key, indices.map(getPoint)];
						}));

						curateTrackedPointsWithFacemesh({ pointTracker, annotations, showDebugRegionFilter, ctx, canvas, s });

						// console.log(pointTracker.pointCount, cameraFramesSinceFacemeshUpdate.length, pointTracker.curXY);

						pointsBasedOnFaceInViewConfidence = facemeshPrediction.faceInViewConfidence;

						const keypoints = facemeshPrediction.keypoints;
						if (keypoints) {
							const top = keypoints[10]; // Top of forehead
							const bottom = keypoints[2]; // Bottom of nose (formerly chin; this better avoids jaw movement effects)
							const left = keypoints[454]; // Subject left (Image right)
							const right = keypoints[234]; // Subject right (Image left)

							if (top && bottom && left && right) {

								headTilt.keypoints = { top, bottom, left, right };

								// Pitch (X-axis rotation)
								const pitchDy = bottom.y - top.y;
								const pitchDz = bottom.z - top.z;
								headTilt.pitch = Math.atan2(pitchDz, Math.abs(pitchDy));

								// Yaw (Y-axis rotation)
								const yawDx = left.x - right.x;
								const yawDz = left.z - right.z;
								headTilt.yaw = Math.atan2(yawDz, Math.abs(yawDx));

								// Roll (Z-axis rotation)
								const rollDy = left.y - right.y;
								const rollDx = left.x - right.x;
								headTilt.roll = Math.atan2(rollDy, rollDx);

								if (typeof OneEuroFilter !== "undefined") {
									const timestamp = performance.now() / 1000;
									if (!headTiltFilters.pitch) {
										const freq = 60;
										const mincutoff = 0.01;
										const beta = 5.0;
										const dcutoff = 0.7;
										for (const axis of ["pitch", "yaw", "roll"]) {
											headTiltFilters[axis] = new OneEuroFilter(freq, mincutoff, beta, dcutoff);
										}
									}
									for (const axis of ["pitch", "yaw", "roll"]) {
										headTilt[axis] = headTiltFilters[axis].filter(headTilt[axis], timestamp);
									}
								}
							}
						}

						const gestures = detectGestures({ blinkInfo, mouthInfo, sleepGestureProgress, sleepGestureEyesClosedDuration, mouseButtonUntilMouthCloses, annotations, s, deltaTime });
						({ blinkInfo, mouthInfo, sleepGestureProgress, sleepGestureEyesClosedDuration, mouseButtonUntilMouthCloses } = gestures);
						const { clickButton, sleepGestureTriggered } = gestures;
						if (sleepGestureTriggered) {
							paused = !paused;
							updatePaused();
							sleepSweep?.sleepModeWasToggled(paused);
						}

						const buttonNames = ["left", "middle", "right"];
						for (let buttonIndex = 0; buttonIndex < 3; buttonIndex++) {
							const buttonIsActive = clickButton === buttonIndex;
							if (buttonIsActive !== buttonStates[buttonNames[buttonIndex]]) {
								// Wait for confirmation of the button state change before playing SFX
								// but not before updating buttonStates, since we check that in this loop
								// to decide whether to call setMouseButtonState.
								// We don't want to send extraneous mouse button changes to the main process,
								// even if it does track button states itself. If nothing else it's wasted IPC.
								// That said, an argument could be made for updating lastMouseDownTime later
								// if the IPC is slow, to extend the time frame for making a simple click
								// rather than a drag.
								if (!setMouseButtonState) {
									console.warn("setMouseButtonState function not provided");
								} else {
									const maybeAPromise = setMouseButtonState(buttonIndex, buttonIsActive);
									const playSoundForButton = (changedButtonState) => {
										if (changedButtonState) {
											if (buttonIndex === 1) {
												playSound(buttonIsActive ? "middleClickPress" : "middleClickRelease", {
													volume: 4,
												});
											} else {
												playSound(buttonIsActive ? "clickPress" : "clickRelease", {
													playbackRate: buttonIndex === 0 ? 1 : buttonIndex === 2 ? 1.2 : 1.5,
												});
											}
										}
									};
									if (maybeAPromise instanceof Promise) {
										maybeAPromise.then(playSoundForButton);
									} else {
										playSoundForButton(maybeAPromise);
									}
								}
								buttonStates[buttonNames[buttonIndex]] = buttonIsActive;
								if (buttonIsActive) {
									lastMouseDownTime = performance.now();
								} else {
									// Limit "Delay Before Dragging" effect to the duration of a click.
									// TODO: consider how this affects releasing a mouse button if two are pressed (not currently possible)
									// TODO: rename variable, maybe change it to store a cool-down timer? but that would need more state management just for concept clarity
									lastMouseDownTime = -Infinity; // sorry, making this variable a misnomer
								}
							}
						}
					}, () => {
						facemeshEstimating = false;
						facemeshFirstEstimation = false;
					});
				}
			}
			pointTracker.update(imageData);
		}

		updateInputFeedback?.({
			headNotFound: !face && !facemeshPrediction,
			blinkInfo,
			mouthInfo,
			virtualJoystickInfo,
		});

		if (facemeshPrediction) {
			ctx.fillStyle = "red";

			const bad = facemeshPrediction.faceInViewConfidence < faceInViewConfidenceThreshold;
			ctx.fillStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
			if (!bad || pointTracker.pointCount < 3 || facemeshPrediction.faceInViewConfidence > pointsBasedOnFaceInViewConfidence + 0.05) {
				if (bad) {
					ctx.fillStyle = 'rgba(255,0,255)';
				}
				for (const { x, y } of facemeshPrediction.keypoints) {
					ctx.fillRect(x, y, 1, 1);
				}
			} else {
				if (update && useFacemesh) {
					pointsBasedOnFaceInViewConfidence -= 0.001;
				}
			}

			const keypoints = facemeshPrediction.keypoints;
			if (showDebugHeadTilt && keypoints) {
				const { top, bottom, left, right } = headTilt.keypoints;
				const nose = keypoints[1];

				if (top && bottom && left && right && nose) {

					const cx = nose.x;
					const cy = nose.y;
					const arrowLen = 100;

					ctx.save();
					ctx.translate(cx, cy);

					ctx.fillStyle = "cyan";
					ctx.font = "bold 20px monospace";
					ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
					ctx.lineWidth = 3;
					ctx.lineJoin = "round";

					const textX = 60;
					const textLineHeight = 25;
					const textYStart = -10;


					const headTiltRows = [
						{ label: t("debug.headTilt.pitch", { defaultValue: "Pitch:" }), value: `${(headTilt.pitch * 180 / Math.PI).toFixed(1)}°` },
						{ label: t("debug.headTilt.yaw", { defaultValue: "Yaw:" }), value: `${(headTilt.yaw * 180 / Math.PI).toFixed(1)}°` },
						{ label: t("debug.headTilt.roll", { defaultValue: "Roll:" }), value: `${(headTilt.roll * 180 / Math.PI).toFixed(1)}°` },
					];
					const labelWidths = headTiltRows.map(row => ctx.measureText(row.label).width);
					const maxLabelWidth = Math.max(...labelWidths);
					const valueColumnTemplate = "-180.0°";
					const maxValueWidth = ctx.measureText(valueColumnTemplate).width;
					const labelToValueGap = 10;
					const boxPadding = 10;
					const boxWidth = boxPadding * 2 + maxLabelWidth + labelToValueGap + maxValueWidth;
					const boxHeight = textLineHeight * headTiltRows.length;
					const valueColumnRightOffset = boxPadding + maxLabelWidth + labelToValueGap + maxValueWidth;

					// Calculate screen coordinates for the text box
					let screenX = s.mirror ? canvas.width - cx : cx;
					let screenY = cy;

					// Nominal position relative to head center
					let textScreenX = screenX + textX;
					let textScreenY = screenY + textYStart;

					// Clamp to canvas bounds
					textScreenX = Math.max(boxPadding, Math.min(canvas.width - boxWidth - boxPadding, textScreenX));
					textScreenY = Math.max(textLineHeight, Math.min(canvas.height - boxHeight + textLineHeight, textScreenY));

					ctx.save();
					if (s.mirror) {
						ctx.scale(-1, 1);
					}

					const screenNoseX = s.mirror ? canvas.width - cx : cx;
					const screenNoseY = cy;

					const dx = textScreenX - screenNoseX;
					const dy = textScreenY - screenNoseY;

					for (let i = 0; i < headTiltRows.length; i++) {
						const row = headTiltRows[i];
						const baselineY = dy + textLineHeight * (i + 1);
						const labelX = dx + boxPadding;
						const valueTextWidth = ctx.measureText(row.value).width;
						const valueRightX = dx + valueColumnRightOffset;
						const valueX = valueRightX - valueTextWidth;
						ctx.strokeText(row.label, labelX, baselineY);
						ctx.fillText(row.label, labelX, baselineY);
						ctx.strokeText(row.value, valueX, baselineY);
						ctx.fillText(row.value, valueX, baselineY);
					}

					ctx.restore();

					// Visualize head direction
					const vUp = { x: top.x - bottom.x, y: top.y - bottom.y, z: top.z - bottom.z }; // Up vector (Chin to Top)
					const vRight = { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }; // Right vector (Right to Left)

					// Cross Product: Right x Up
					const vFwd = {
						x: vRight.y * vUp.z - vRight.z * vUp.y,
						y: vRight.z * vUp.x - vRight.x * vUp.z,
						z: vRight.x * vUp.y - vRight.y * vUp.x
					};

					const mag = Math.hypot(vFwd.x, vFwd.y, vFwd.z);
					if (mag > 0.001) {
						ctx.strokeStyle = "cyan";
						ctx.beginPath();
						ctx.moveTo(0, 0);
						const s = arrowLen / mag;
						ctx.lineTo(vFwd.x * s, vFwd.y * s);
						ctx.stroke();

						ctx.fillStyle = "cyan";
						ctx.beginPath();
						ctx.arc(vFwd.x * s, vFwd.y * s, 5, 0, Math.PI * 2);
						ctx.fill();
					}

					ctx.restore();
				}
			}
		}

		const drawAspectMetrics = ({ corners, lowest, highest, active, thresholdMet }) => {
			const [a, b] = corners;
			ctx.strokeStyle = active ? "red" : thresholdMet ? "yellow" : "cyan";
			ctx.beginPath();
			ctx.moveTo(a[0], a[1]);
			ctx.lineTo(b[0], b[1]);
			ctx.stroke();
			// draw extents as a rectangle
			ctx.save();
			ctx.translate(a[0], a[1]);
			ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
			ctx.beginPath();
			ctx.rect(0, lowest, Math.hypot(b[0] - a[0], b[1] - a[1]), highest - lowest);
			ctx.stroke();
			ctx.restore();
		};

		if (blinkInfo?.used) {
			ctx.save();
			ctx.lineWidth = 2;
			drawAspectMetrics(blinkInfo.leftEye);
			drawAspectMetrics(blinkInfo.rightEye);

			if (showDebugEyeZoom) {
				debugEyeCanvas.style.display = "";
				const boxWidth = 150;
				const boxHeight = 100;

				if (debugEyeCanvas.width !== boxWidth * 2 || debugEyeCanvas.height !== boxHeight) {
					debugEyeCanvas.width = boxWidth * 2;
					debugEyeCanvas.height = boxHeight;
				}

				debugEyeCtx.fillStyle = "black";
				debugEyeCtx.fillRect(0, 0, debugEyeCanvas.width, debugEyeCanvas.height);
				debugEyeCtx.save();
				debugEyeCtx.translate(s.mirror ? debugEyeCanvas.width : 0, 0);
				debugEyeCtx.scale(s.mirror ? -1 : 1, 1);

				const zoom = 5;
				const drawDebugEye = (eye, offsetX) => {
					const points = [...eye.upperContour, ...eye.lowerContour];
					let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
					for (const [x, y] of points) {
						minX = Math.min(minX, x);
						minY = Math.min(minY, y);
						maxX = Math.max(maxX, x);
						maxY = Math.max(maxY, y);
					}
					const cx = (minX + maxX) / 2;
					const cy = (minY + maxY) / 2;

					const sw = boxWidth / zoom;
					const sh = boxHeight / zoom;
					const sx = cx - sw / 2;
					const sy = cy - sh / 2;

					debugEyeCtx.drawImage(cameraVideo, sx, sy, sw, sh, offsetX, 0, boxWidth, boxHeight);

					debugEyeCtx.save();
					debugEyeCtx.beginPath();
					debugEyeCtx.rect(offsetX, 0, boxWidth, boxHeight);
					debugEyeCtx.clip();

					debugEyeCtx.translate(offsetX, 0);
					debugEyeCtx.scale(zoom, zoom);
					debugEyeCtx.translate(-sx, -sy);

					debugEyeCtx.lineWidth = 1 / zoom * 2;
					debugEyeCtx.strokeStyle = "lime";

					for (const contour of [eye.upperContour, eye.lowerContour]) {
						debugEyeCtx.beginPath();
						for (let i = 0; i < contour.length; i++) {
							const [x, y] = contour[i];
							if (i === 0) debugEyeCtx.moveTo(x, y);
							else debugEyeCtx.lineTo(x, y);
						}
						debugEyeCtx.stroke();
					}
					debugEyeCtx.restore();
				};

				drawDebugEye(blinkInfo.rightEye, 0);
				drawDebugEye(blinkInfo.leftEye, boxWidth);

				debugEyeCtx.restore();
			} else {
				debugEyeCanvas.style.display = "none";
			}
			ctx.restore();
		}
		if (mouthInfo?.used) {
			ctx.save();
			ctx.lineWidth = 2;
			drawAspectMetrics(mouthInfo);
			ctx.restore();
		}


		if (face) {
			const bad = faceScore < faceScoreThreshold;
			ctx.strokeStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
			if (!bad || pointTracker.pointCount < 2 || faceScore > pointsBasedOnFaceScore + 0.05) {
				if (bad) {
					ctx.strokeStyle = 'rgba(255,0,255)';
				}
				if (update && useClmTracking) {
					pointsBasedOnFaceScore = faceScore;

					curateTrackedPointsWithClmtrackr({ pointTracker, face, showDebugRegionFilter, ctx, canvas, s });
				}
			} else {
				if (update && useClmTracking) {
					pointsBasedOnFaceScore -= 0.001;
				}
			}
			if (showClmTracking) {
				clmTracker.draw(canvas, undefined, undefined, true);
			}
		}
		ctx.fillStyle = "lime";
		pointTracker.draw(ctx);

		if (update) {
			const screenWidth = window.electronAPI ? (virtualDisplayBounds?.width ?? screen.width) : innerWidth;
			const screenHeight = window.electronAPI ? (virtualDisplayBounds?.height ?? screen.height) : innerHeight;
			const screenOffsetX = window.electronAPI ? (virtualDisplayBounds?.x ?? 0) : 0;
			const screenOffsetY = window.electronAPI ? (virtualDisplayBounds?.y ?? 0) : 0;

			let [movementX, movementY] = pointTracker.getMovement();

			// Invert X axis of camera video motion to match screen
			// (The camera VIEW is mirrored by default, but the video data is always opposite to the screen.)
			movementX *= -1;

			// Acceleration curves add a lot of stability,
			// letting you focus on a specific point without jitter, but still move quickly.

			// let accelerate = (delta, distance) => (delta / 10) * (distance ** 0.8);
			// let accelerate = (delta, distance) => (delta / 1) * (Math.abs(delta) ** 0.8);
			let accelerate = (delta, _distance) => (delta / 1) * (Math.abs(delta * 5) ** s.headTrackingAcceleration);

			let distance = Math.hypot(movementX, movementY);
			let deltaX = accelerate(movementX * s.headTrackingSensitivityX, distance);
			let deltaY = accelerate(movementY * s.headTrackingSensitivityY, distance);

			if (s.headTrackingTiltInfluence > 0) {
				const yawRange = [
					s.headTiltYawOffset - s.headTiltYawRange / 2,
					s.headTiltYawOffset + s.headTiltYawRange / 2
				];
				const pitchRange = [
					s.headTiltPitchOffset - s.headTiltPitchRange / 2,
					s.headTiltPitchOffset + s.headTiltPitchRange / 2
				];

				function normalize(value, min, max) {
					return (value - min) / (max - min);
				}

				let targetX = (1 - normalize(headTilt.yaw, yawRange[0], yawRange[1]));
				let targetY = normalize(headTilt.pitch, pitchRange[0], pitchRange[1]);

				let deltaXToMatchTilt = targetX - mouseX / screenWidth;
				let deltaYToMatchTilt = targetY - mouseY / screenHeight;
				if (s.headTrackingMovementMode !== "direct") {
					targetX = targetX * 2 - 1;
					targetY = targetY * 2 - 1;
					// Normalize to within circle, matching later clamping to joystickMaxMagnitude.
					// If the target isn't constrained to the bounds of what's reachable,
					// it can lead to wild jitter of the angle of the virtual joystick.
					const length = Math.hypot(targetX, targetY);
					if (length > joystickMaxMagnitude) {
						const scale = joystickMaxMagnitude / length;
						targetX *= scale;
						targetY *= scale;
					}
					deltaXToMatchTilt = targetX - virtualJoystickX;
					deltaYToMatchTilt = targetY - virtualJoystickY;
				}

				// Slow down movement away from target, speed up movement towards target*
				// *conditionally. Applies to part of the slider range.
				// (Hey look, we can reuse the normalize function to choose where on the slider these effects kick in!)
				// - It might be worth trying other functions, e.g. exponential or sigmoid,
				//   or adding limits to how much it can change to see if it feels better.
				// - "Speeding up" necessarily incorporates any jitter from the head tilt,
				//   if we're just lerping towards the target.
				//   TODO: try incorporating the magnitude of the delta into the influence,
				//   such that zero delta will not move towards the head tilt target,
				//   ...unless we're at 100% of the slider? We still want to support
				//   pure head tilt mode. So I'm not sure what the ramp should be.
				// - Could make these different settings, which would make it less arbitrary (re: the 80% to 100% influence range),
				//   but not necessarily easier for the average user to tune; at some point you say
				//   "wow that's a lot of options, maybe I'll explore them later..." and back away slowly.
				//   This setting in particular is already probably hard to understand, so unless
				//   splitting it can make it a lot clearer, it's probably better not to add to the decision fatigue.
				const slowingInfluence = s.headTrackingTiltInfluence;
				const speedingInfluence = Math.max(0, Math.min(1, normalize(s.headTrackingTiltInfluence, 0.8, 1)));
				if (deltaX * deltaXToMatchTilt < 0) {
					deltaX *= 1 - slowingInfluence;
				} else {
					deltaX += (deltaXToMatchTilt - deltaX) * speedingInfluence;
				}
				if (deltaY * deltaYToMatchTilt < 0) {
					deltaY *= 1 - slowingInfluence;
				} else {
					deltaY += (deltaYToMatchTilt - deltaY) * speedingInfluence;
				}
			}

			// Mimicking eViacam's "Motion Threshold" implementation
			// https://github.com/cmauri/eviacam/blob/a4032ed9c59def5399a93e74f5ea84513d2f42b1/wxutil/mousecontrol.cpp#L310-L312
			// (a threshold on instantaneous Manhattan distance, or in other words, x and y speed, separately)
			// - It's applied after s.headTrackingAcceleration, following eViacam's lead,
			// which makes sense in order to have the setting's unit make sense as "pixels",
			// rather than "pixels before applying a function",
			// to say nothing of the qualitative differences there might be in reordering the operations.
			// - Note that it causes jumps which are increasingly noticeable as the setting is increased.
			// - TODO: consider a "leash" behavior, or a hybrid perhaps
			//   Note that a leash behavior might be less responsive to direction changes,
			//   and might not achieve the goal of stability unless you move back slightly,
			//   since if you've just pulled the leash left for instance, pulling it left
			//   will move it no matter how small, which might turn a click into a drag (if the "Delay Before Dragging" setting doesn't prevent it).
			//   You have to be in the center of the leash region for it to provide stability.
			//   I'm not sure what a hybrid would look like; it might make more sense as two
			//   separate settings, "motion threshold" and "leash distance".
			if (Math.abs(deltaX * screenWidth) < s.headTrackingMinDistance) {
				deltaX = 0;
			}
			if (Math.abs(deltaY * screenHeight) < s.headTrackingMinDistance) {
				deltaY = 0;
			}
			// Avoid dragging when trying to click by ignoring movement for a short time after a mouse down.
			// This applied previously also to release, to help with double clicks,
			// but this felt bad, and I find personally that I can still do double clicks without that help.
			const timeSinceMouseDown = performance.now() - lastMouseDownTime;
			const preventDragging = timeSinceMouseDown < s.delayBeforeDragging;

			if (debugAcceleration) {
				const graphWidth = 200;
				const graphHeight = 150;
				const graphMaxInput = 0.2;
				const graphMaxOutput = 0.4;
				const highlightInputRange = 0.01;
				ctx.save();
				ctx.fillStyle = "black";
				ctx.fillRect(0, 0, graphWidth, graphHeight);
				const highlightInput = movementX * s.headTrackingSensitivityX;
				for (let x = 0; x < graphWidth; x++) {
					const input = x / graphWidth * graphMaxInput;
					const output = accelerate(input, input);
					const y = output / graphMaxOutput * graphHeight;
					// ctx.fillStyle = Math.abs(y - deltaX) < 1 ? "yellow" : "lime";
					const highlight = Math.abs(Math.abs(input) - Math.abs(highlightInput)) < highlightInputRange;
					if (highlight) {
						ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
						ctx.fillRect(x, 0, 1, graphHeight);
					}
					ctx.fillStyle = highlight ? "yellow" : "lime";
					ctx.fillRect(x, graphHeight - y, 1, y);
				}
				ctx.restore();
			}

			// This should never happen
			if (!isFinite(deltaX) || !isFinite(deltaY)) {
				return;
			}

			if (!paused) {
				if (s.headTrackingMovementMode === "direct") {
					if (!preventDragging) {
						mouseX += deltaX * screenWidth;
						mouseY += deltaY * screenHeight;
					}
					virtualJoystickInfo = null;
				} else {
					virtualJoystickX += deltaX;
					virtualJoystickY += deltaY;

					const numDirections = parseInt(s.headTrackingMovementMode.match(/(\d+)/)?.[1] ?? 0, 10);

					virtualJoystickInfo = {
						x: virtualJoystickX,
						y: virtualJoystickY,
						numDirections,
						active: false,
						deadzone: joystickMinSpeedThreshold,
						maxMagnitude: joystickMaxMagnitude,
					};

					const distance = Math.hypot(virtualJoystickX, virtualJoystickY);
					if (distance > joystickMaxMagnitude * joystickMinSpeedThreshold) {
						let angle = Math.atan2(virtualJoystickY, virtualJoystickX);

						if (numDirections) {
							// - Math.PI / 2 and + Math.PI / 2 are for 6 direction mode
							// Note that most isometric games use 2:1 slopes rather than true 120 degree angles
							angle = Math.round((angle - Math.PI / 2) / (Math.PI * 2) * numDirections) / numDirections * (Math.PI * 2) + Math.PI / 2;

							const angleDiff = Math.atan2(Math.sin(angle - virtualDPadAngle), Math.cos(angle - virtualDPadAngle));

							if (
								!isFinite(virtualDPadAngle) ||
								Math.abs(angleDiff) > Math.PI * 2 / numDirections / 2 * (1 + joystickAngleHysteresis)
							) {
								virtualDPadAngle = angle;
								virtualJoystickSpeedRampStartTime = performance.now();
							}
						} else {
							virtualDPadAngle = angle;
						}

						const timeAtThisSector = performance.now() - virtualJoystickSpeedRampStartTime; // milliseconds
						const speedRampOverTime = Math.min(1, timeAtThisSector / joystickSpeedRampTime);
						const speed = joystickMaxSpeed * Math.pow(
							Math.max(0, Math.min(1,
								((distance / joystickMaxMagnitude) - joystickMinSpeedThreshold) / (joystickMaxSpeedThreshold - joystickMinSpeedThreshold)
							)),
							joystickDistanceToSpeedExponent
						) * Math.pow(
							speedRampOverTime,
							joystickTimeToSpeedExponent
						);
						if (!preventDragging && isFinite(virtualDPadAngle) && isFinite(speed)) {
							mouseX += Math.cos(virtualDPadAngle) * speed * deltaTime;
							mouseY += Math.sin(virtualDPadAngle) * speed * deltaTime;
						}

						virtualJoystickInfo.active = true;
					} else {
						virtualJoystickSpeedRampStartTime = performance.now();
					}
					// normalize to within circle
					if (distance > joystickMaxMagnitude) {
						const scale = joystickMaxMagnitude / distance;
						virtualJoystickX *= scale;
						virtualJoystickY *= scale;
						virtualJoystickInfo.x = virtualJoystickX;
						virtualJoystickInfo.y = virtualJoystickY;
					}
					// normalize to within square
					// if (Math.abs(virtualJoystickX) > joystickMaxMagnitude) {
					// 	virtualJoystickX = Math.sign(virtualJoystickX) * joystickMaxMagnitude;
					// 	virtualJoystickInfo.x = virtualJoystickX;
					// }
					// if (Math.abs(virtualJoystickY) > joystickMaxMagnitude) {
					// 	virtualJoystickY = Math.sign(virtualJoystickY) * joystickMaxMagnitude;
					// 	virtualJoystickInfo.y = virtualJoystickY;
					// }
				}

				mouseX = Math.min(Math.max(screenOffsetX, mouseX), screenOffsetX + screenWidth);
				mouseY = Math.min(Math.max(screenOffsetY, mouseY), screenOffsetY + screenHeight);

				if (mouseNeedsInitPos) {
					// TODO: option to get preexisting mouse position instead of set it to center of screen
					mouseX = screenOffsetX + screenWidth / 2;
					mouseY = screenOffsetY + screenHeight / 2;
					mouseNeedsInitPos = false;
				}
				if (window.electronAPI) {
					window.electronAPI.moveMouse(~~mouseX, ~~mouseY);
					pointerEl.style.display = "none";
				} else {
					pointerEl.style.display = "";
					pointerEl.style.left = `${Math.floor(mouseX)}px`;
					pointerEl.style.top = `${Math.floor(mouseY)}px`;
				}
				if (TrackyMouse.onPointerMove) {
					TrackyMouse.onPointerMove(mouseX, mouseY);
				}
			}
		}
		ctx.restore();

		if (showDebugText) {
			ctx.save();
			ctx.fillStyle = "#fff";
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 3;
			ctx.font = "20px sans-serif";
			ctx.beginPath();
			const text3 = `${t("debug.faceConvergenceScore", { defaultValue: "Face convergence score:" })} ${((useFacemesh && facemeshPrediction) ? t("common.notApplicable", { defaultValue: "N/A" }) : faceConvergence.toFixed(4))}`;
			const text1 = `${t("debug.faceTrackingScore", { defaultValue: "Face tracking score:" })} ${((useFacemesh && facemeshPrediction) ? facemeshPrediction.faceInViewConfidence : faceScore).toFixed(4)}`;
			const text2 = `${t("debug.pointsBasedOnScore", { defaultValue: "Points based on score:" })} ${((useFacemesh && facemeshPrediction) ? pointsBasedOnFaceInViewConfidence : pointsBasedOnFaceScore).toFixed(4)}`;
			ctx.strokeText(text1, 50, 50);
			ctx.fillText(text1, 50, 50);
			ctx.strokeText(text2, 50, 70);
			ctx.fillText(text2, 50, 70);
			ctx.strokeText(text3, 50, 170);
			ctx.fillText(text3, 50, 170);
			ctx.fillStyle = "lime";
			ctx.fillRect(0, 150, faceConvergence, 5);
			ctx.fillRect(0, 0, faceScore * canvas.width, 5);
			ctx.restore();
		}
		stats?.update();
	}

	// Can't use requestAnimationFrame, doesn't work with webPreferences.backgroundThrottling: false (at least in some version of Electron (v12 I think, when I tested it), on Ubuntu, with XFCE)
	const iid = setInterval(function animationLoop() {
		draw(!paused || document.visibilityState === "visible" || isDesktopApp);
	}, 15);

	let autoDemo = false;
	try {
		autoDemo = localStorage.trackyMouseAutoDemo === "true";
	} catch (_error) {
		// ignore; this is just for development
	}
	if (autoDemo) {
		TrackyMouse.useDemoFootage();
	} else if (window.electronAPI) {
		TrackyMouse.useCamera();
	} else {
		// Passively querying the camera permission isn't supported in all browsers,
		// hence some of the complex logic in useCamera, but when it is,
		// we can connect to the camera right away if the permission is already granted.
		// This speeds up the development cycle, at the very least.
		navigator.permissions?.query?.({ name: "camera" }).then((status) => {
			if (status.state === "granted") {
				TrackyMouse.useCamera();
			}
		}, (error) => {
			console.log("Error querying permissions:", error);
		});
	}

	const updateStartStopButton = () => {
		if (paused) {
			startStopButton.textContent = t("ui.startStopButton.start", { defaultValue: "Start" });
			startStopButton.setAttribute("aria-pressed", "false");
		} else {
			startStopButton.textContent = t("ui.startStopButton.stop", { defaultValue: "Stop" });
			startStopButton.setAttribute("aria-pressed", "true");
		}
	};
	const updatePaused = () => {
		mouseNeedsInitPos = true;
		if (paused) {
			pointerEl.style.display = "none";
		}
		updateStartStopButton();
		notifyToggleState?.(!paused);
	};
	const handleShortcut = (shortcutType) => {
		if (shortcutType === "toggle-tracking") {
			paused = !paused;
			updatePaused();
		}
	};
	settingsLoadedPromise.then(updatePaused);

	// Try to handle both the global and local shortcuts
	// If the global shortcut successfully registered, keydown shouldn't occur for the shortcut, right?
	// I hope there's no cross-platform issue with this.
	let removeShortcutListener = null;
	if (window.electronAPI) {
		removeShortcutListener = window.electronAPI.onShortcut(handleShortcut);
	}
	const handleKeydown = (event) => {
		// Same shortcut as the global shortcut in the electron app
		if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "F9") {
			handleShortcut("toggle-tracking");
		}
	};
	addEventListener("keydown", handleKeydown);

	return {
		_element: uiContainer,
		_setPaused(value) {
			paused = value;
			updatePaused();
		},
		_getPaused() {
			return paused;
		},
		_waitForSettingsLoaded() {
			return settingsLoadedPromise;
		},
		get _facemeshPrediction() {
			return facemeshPrediction;
		},
		get _headTilt() {
			return headTilt;
		},
		get _video() {
			return cameraVideo;
		},
		dispose() {
			// TODO: re-structure so that cleanup can succeed even if initialization fails
			// OOP would help with this, by storing references in an object, but it doesn't necessarily
			// need to be converted to a class, it could just be an object, with a try-finally used for returning the API with a `dispose` method.
			// Wouldn't need to change the API that way.
			// (Would also be easy to maintain backwards compatibility while switching to using a class,
			// returning an instance of the class from `TrackyMouse.init` but deprecating it in favor of constructing the class.)

			clearInterval(iid);

			// stopping camera stream is important, not sure about other resetting
			reset();

			// just in case there's any async code looking at whether it's paused
			paused = true;

			if (detector) {
				detector.dispose();
				detector = null;
			}
			if (clmTracker) {
				// not sure this helps clean up any resources
				clmTracker.reset();
			}

			pointerEl.remove();

			stats?.domElement.remove(); // there is no dispose method but this may be all that it would need to do https://github.com/mrdoob/stats.js/pull/96

			removeEventListener("keydown", handleKeydown);

			disposeSettingsUI();

			removeShortcutListener?.();

			// This is a little awkward, reversing the initialization based on a possibly-preexisting element
			// Could save and restore innerHTML but that won't restore event listeners, references, etc.
			// and may not even be desired if the HTML was placeholder text mentioning it not yet being initialized for example.
			uiContainer.classList.remove("tracky-mouse-ui");
			uiContainer.innerHTML = "";
			if (!div) {
				uiContainer.remove();
			}
		},
	};
};

// Wrapper that manages an inner instance and recreates it when the language is changed.
TrackyMouse.init = function (div, opts = {}) {
	let inner = null;

	// UI state saving could be cleaner as part of the inner instance idk
	// Or, you know, ideally we update the UI text reactively without
	// stopping/starting the camera stream etc. when switching languages.
	const saveUIState = () => {
		const paused = inner._getPaused();
		const collapsibles = inner._element.querySelectorAll("details");
		const openStates = Array.from(collapsibles).map(c => c.open);
		const scrollables = inner._element.querySelectorAll("*");
		const scrollPositions = Array.from(scrollables).map(s => [s.scrollLeft, s.scrollTop]);
		const focusedElementSelector = Array.from(document.activeElement?.classList || []).map(c => `.${c}`).join("") || "*";
		const focusedElementIndexWithinSelected = Array.from(inner._element.querySelectorAll(focusedElementSelector)).indexOf(document.activeElement);
		return { paused, openStates, scrollPositions, focusedElementSelector, focusedElementIndexWithinSelected };
	};
	const restoreUIState = ({ paused, openStates, scrollPositions, focusedElementSelector, focusedElementIndexWithinSelected }) => {
		inner._waitForSettingsLoaded().then(() => {
			inner._setPaused(paused);
		});
		// assuming DOM structure doesn't change
		const collapsibles = inner._element.querySelectorAll("details");
		for (let i = 0; i < collapsibles.length; i++) {
			collapsibles[i].open = openStates[i];
		}
		const scrollables = inner._element.querySelectorAll("*");
		for (let i = 0; i < scrollables.length; i++) {
			const [scrollLeft, scrollTop] = scrollPositions[i];
			scrollables[i].scrollLeft = scrollLeft;
			scrollables[i].scrollTop = scrollTop;
		}
		if (focusedElementSelector) {
			const elementToFocus = inner._element.querySelectorAll(focusedElementSelector)[focusedElementIndexWithinSelected];
			elementToFocus?.focus();
		}
	};
	const reinit = () => {
		const uiState = saveUIState();
		inner.dispose();
		createInner();
		restoreUIState(uiState);
	};

	const createInner = () => {
		inner = TrackyMouse._initInner(div, opts, reinit);
	};

	createInner();

	return new Proxy({}, {
		get(_target, prop) {
			if (prop in inner) {
				return inner[prop];
			}
		}
	});

};

TrackyMouse.initScreenOverlay = initScreenOverlay;
