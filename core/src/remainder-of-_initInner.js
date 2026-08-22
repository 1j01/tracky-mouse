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

	const { updateDisabledStates, populateCameraList } = initSettingsUI({
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
		debugPointsCanvas.width = cameraVideo.videoWidth;
		debugPointsCanvas.height = cameraVideo.videoHeight;

		// .tracky-mouse-canvas-container needs aspect-ratio CSS property
		// so that the video can be scaled to fit the container.
		canvasContainer.style.aspectRatio = `${cameraVideo.videoWidth} / ${cameraVideo.videoHeight}`;
		canvasContainer.style.setProperty('--aspect-ratio', cameraVideo.videoWidth / cameraVideo.videoHeight);

		pointTracker = new PointTracker({ cameraVideo, maxPoints, pruningGridSize, ctx, debugPointsCtx });
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

	const debugPointsCanvas = document.createElement("canvas");
	debugPointsCanvas.width = canvas.width;
	debugPointsCanvas.height = canvas.height;
	const debugPointsCtx = debugPointsCanvas.getContext("2d");

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