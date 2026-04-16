
const defaultWidth = 640;
const defaultHeight = 480;

let showedCameraError = false;
const cameraAccessSlowWarningDelayMS = 5000;
let cameraAccessSlowWarningTimeoutID;
let errorMessage = document.getElementById("error-message");
const cameraSelect = document.getElementById("camera-select");
const useCameraButton = document.getElementById("use-camera-button");
const cameraVideo = document.getElementById("camera-video");

let s = {};

// Basically Promise.withResolvers (but I'm not sure browser support is good enough)
function createDeferred() {
	let resolve, reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}


function stopCameraStream() {
	if (cameraVideo.srcObject) {
		for (const track of cameraVideo.srcObject.getTracks()) {
			track.stop();
		}
	}
	cameraVideo.srcObject = null;
};

const reset = stopCameraStream;


function populateCameraList() {
	let matchedCameraIdDeferred = createDeferred();
	navigator.mediaDevices.enumerateDevices().then((devices) => {
		const videoDevices = devices.filter(device => device.kind === 'videoinput');

		let knownCameras = {};
		try {
			knownCameras = JSON.parse(localStorage.getItem("tracky-mouse-known-cameras")) || {};
		} catch (error) {
			console.error("Failed to parse known cameras from localStorage", error);
		}
		let knownCamerasChanged = false;
		for (const device of videoDevices) {
			if (device.deviceId && device.label) {
				if (!knownCameras[device.deviceId] || knownCameras[device.deviceId].name !== device.label) {
					knownCameras[device.deviceId] = { name: device.label };
					knownCamerasChanged = true;
				}
			}
		}
		if (knownCamerasChanged) {
			try {
				localStorage.setItem("tracky-mouse-known-cameras", JSON.stringify(knownCameras));
			} catch (error) {
				console.error("Failed to store known cameras in localStorage", error);
			}
		}

		cameraSelect.innerHTML = "";

		const defaultOption = document.createElement("option");
		defaultOption.value = "";
		defaultOption.text = t("settings.cameraSource.defaultCamera", { defaultValue: "Default" });
		cameraSelect.appendChild(defaultOption);

		let matchingDeviceId = "";
		for (const device of videoDevices) {
			const option = document.createElement('option');
			option.value = device.deviceId;
			option.text = device.label || t("settings.cameraSource.numberedCamera", { defaultValue: "Camera %0" }).replace("%0", cameraSelect.length);
			cameraSelect.appendChild(option);
			if (device.deviceId === s.cameraDeviceId) {
				matchingDeviceId = device.deviceId;
			} else if (device.label === knownCameras[s.cameraDeviceId]?.name) {
				matchingDeviceId ||= device.deviceId;
			}
		}

		// Defaulting to "Default" would imply a preference isn't stored...
		// but would it be more friendly anyways?
		// cameraSelect.value = found ? s.cameraDeviceId : "";

		// Show a placeholder for the selected camera
		if (s.cameraDeviceId && !matchingDeviceId) {
			const option = document.createElement("option");
			option.value = s.cameraDeviceId;
			const knownInfo = knownCameras[s.cameraDeviceId];
			option.text = knownInfo ? `${knownInfo.name} (${t("settings.cameraSource.unavailableCameraAdjective", { defaultValue: "Unavailable" })})` : t("settings.cameraSource.unavailableCamera", { defaultValue: "Unavailable camera" });
			cameraSelect.appendChild(option);
			cameraSelect.value = s.cameraDeviceId;
		} else {
			cameraSelect.value = matchingDeviceId;
		}
		matchedCameraIdDeferred.resolve(matchingDeviceId);
	});
	return matchedCameraIdDeferred.promise;
};
populateCameraList();
navigator.mediaDevices.addEventListener('devicechange', populateCameraList);


/**
 * For notes, see comments in `TrackyMouse.useCamera`
 * 
 * @param {{phase: "tryPreferredCamera" | "justGetPermission" | "retryPreferredCamera", preferredCameraDeviceId?: string, retryWithCameraDeviceId?: string}} optionsOrEvent 
 */
export async function setupCamera(optionsOrEvent = {}) {
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
			optionsOrEvent.preferredCameraDeviceId :
			"";
	if (deviceIdToTry) {
		delete constraints.video.facingMode;
		constraints.video.deviceId = { exact: deviceIdToTry };
	}
	clearTimeout(cameraAccessSlowWarningTimeoutID);
	errorMessage.hidden = true;
	cameraAccessSlowWarningTimeoutID = setTimeout(() => {
		errorMessage.textContent = "Accessing the camera is taking longer than expected...";
		errorMessage.hidden = false;
	}, cameraAccessSlowWarningDelayMS);
	console.log("TrackyMouse.useCamera phase", phase, "constraints", constraints);
	navigator.mediaDevices.getUserMedia(constraints).then(async (stream) => {
		clearTimeout(cameraAccessSlowWarningTimeoutID);
		if (phase === "justGetPermission") {
			for (const track of stream.getTracks()) {
				track.stop();
			}
			const matchedCameraId = await populateCameraList();
			if (matchedCameraId) {
				setupCamera({ retryWithCameraDeviceId: matchedCameraId, phase: "retryPreferredCamera" });
			} else {
				setupCamera({ retryWithCameraDeviceId: "", phase: "retryPreferredCamera" });
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
			setupCamera({ phase: "justGetPermission" });
			return;
		}
		if (error.name == "NotFoundError" || error.name == "DevicesNotFoundError") {
			errorMessage.textContent = "No camera found. Please make sure you have a camera connected and enabled.";
		} else if (error.name == "NotReadableError" || error.name == "TrackStartError") {
			errorMessage.textContent = "Webcam is already in use. Please make sure you have no other programs using the camera.";
		} else if (error.name === "AbortError") {
			errorMessage.textContent = "Please make sure no other programs are using the camera and try again.";
		} else if (error.name == "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") {
			if (constraints.video.deviceId?.exact) {
				errorMessage.textContent = "The previously selected camera is not available. Try selecting \"Default\" for Video > Camera source, and then select a specific camera if you need to.";
			} else {
				errorMessage.textContent = "Webcam does not support the required resolution. Please change your settings.";
			}
		} else if (error.name == "NotAllowedError" || error.name == "PermissionDeniedError") {
			errorMessage.textContent = "Permission denied. Please enable access to the camera.";
		} else if (error.name == "TypeError") {
			errorMessage.textContent = `${"Something went wrong accessing the camera."})} (${error.name}: ${error.message})`;
		} else {
			errorMessage.textContent = `${"Something went wrong accessing the camera. Please try again."})} (${error.name}: ${error.message})`;
		}
		errorMessage.textContent = `${"⚠️"})} ${errorMessage.textContent}`;
		errorMessage.hidden = false;
		// Play CSS animation only on retries
		errorMessage.style.animation = "none";
		if (showedCameraError) {
			void errorMessage.offsetWidth; // trigger reflow to allow restarting animation
			errorMessage.style.animation = "";
		}
		showedCameraError = true;
	});
};
