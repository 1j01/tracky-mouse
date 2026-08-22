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
