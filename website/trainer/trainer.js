import { TrainerDB } from "./db.js";

const db = new TrainerDB();

const defaultWidth = 640;
const defaultHeight = 480;

let showedCameraError = false;
const cameraAccessSlowWarningDelayMS = 5000;
let cameraAccessSlowWarningTimeoutID;
let errorMessage = document.getElementById("error-message");
/**
 * For notes, see comments in `TrackyMouse.useCamera`
 * 
 * @param {{phase: "tryPreferredCamera" | "justGetPermission" | "retryPreferredCamera", preferredCameraDeviceId?: string, retryWithCameraDeviceId?: string}} optionsOrEvent 
 */
async function setupCamera(optionsOrEvent = {}) {
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
			errorMessage.textContent = "No camera found. Please make sure you have a camera connected and enabled.";
		} else if (error.name == "NotReadableError" || error.name == "TrackStartError") {
			// webcam is already in use
			// or: OBS Virtual Camera is present but OBS is not running with Virtual Camera started
			// TODO: enumerateDevices and give more specific message for OBS Virtual Camera case
			// (listing devices and showing only the OBS Virtual Camera would also be a good clue in itself;
			// though care should be given to make it clear it's a list with one item, with something like "(no more cameras detected)" following the list
			// or "1 camera source detected" preceding it)
			errorMessage.textContent = "Webcam is already in use. Please make sure you have no other programs using the camera.";
		} else if (error.name === "AbortError") {
			// webcam is likely already in use
			// I observed AbortError in Firefox 132.0.2 but I don't know it's used exclusively for this case.
			// Update: it definitely isn't, but I can't say exactly what it means in other cases.
			// Like, it might have to do with permissions being denied outside of a user gesture (distinct from the user denying the permission)
			// I really hope that isn't the problem.
			// errorMessage.textContent = "Webcam may already be in use. Please make sure you have no other programs using the camera.";
			errorMessage.textContent = "Please make sure no other programs are using the camera and try again.";
			// A more honest/helpful message might be:
			// errorMessage.textContent = "Please try again and then make sure no other programs are using the camera and try again again.";
			// errorMessage.textContent = "Please try again before/after making sure no other programs are using the camera.";
			// if it were not to be confusing.
			// That is, one could save some time by just hitting the button to try again before trying to figure out of another program is using the camera,
			// because sometimes that's enough.
		} else if (error.name == "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") {
			// constraints cannot be satisfied by available devices

			// OverconstrainedError can be caused by `deviceId` not matching,
			// either due to the device not being present, or the ID having changed (don't ask me why that can happen but it can)
			// Note: OverconstrainedError has a `constraint` property but not in Firefox so it's not very helpful.
			if (constraints.video.deviceId?.exact) {
				// errorMessage.textContent = "The previously selected camera is not available. Please select a different camera from the dropdown and try again.";
				// errorMessage.textContent = "The previously selected camera is not available. Please mess around with Video > Camera source.";
				// errorMessage.textContent = "The previously selected camera is not available. Try changing Video > Camera source.";
				// errorMessage.textContent = "The previously selected camera is not available. Please select a camera from the \"Camera source\" dropdown in the Video settings and if it doesn't show up, it might after you select Default.";
				errorMessage.textContent = "The previously selected camera is not available. Try selecting \"Default\" for Video > Camera source, and then select a specific camera if you need to.";
				// It's awkward but that's my best attempt at conveying how you may need to proceed
				// without complicated description of how/why the dropdown might be populated with
				// fake information until a camera stream is successfully opened.
			} else {
				errorMessage.textContent = "Webcam does not support the required resolution. Please change your settings.";
			}
		} else if (error.name == "NotAllowedError" || error.name == "PermissionDeniedError") {
			// permission denied in browser
			errorMessage.textContent = "Permission denied. Please enable access to the camera.";
		} else if (error.name == "TypeError") {
			// empty constraints object
			errorMessage.textContent = `${"Something went wrong accessing the camera."})} (${error.name}: ${error.message})`;
		} else {
			// other errors
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

// const video = document.createElement('video');
// video.style.width = '100%';
// video.style.maxWidth = '500px';
// video.style.border = '1px solid #ccc';

// const cameraSelect = document.createElement('select');
// cameraSelect.style.marginBottom = '10px';

// const allowButton = document.createElement('button');
// allowButton.textContent = 'Allow Camera';
// allowButton.style.marginRight = '10px';

// const container = document.createElement('div');
// container.style.padding = '20px';
// container.appendChild(allowButton);
// container.appendChild(cameraSelect);
// container.appendChild(video);
// document.getElementById("trainer-applet").appendChild(container);

// allowButton.addEventListener('click', async () => {
// 	try {
// 		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// 		video.srcObject = stream;
// 		video.play();

// 		// Populate camera selector
// 		const devices = await navigator.mediaDevices.enumerateDevices();
// 		const videoDevices = devices.filter(device => device.kind === 'videoinput');

// 		videoDevices.forEach(device => {
// 			const option = document.createElement('option');
// 			option.value = device.deviceId;
// 			option.textContent = device.label || `Camera ${videoDevices.indexOf(device) + 1}`;
// 			cameraSelect.appendChild(option);
// 		});

// 		allowButton.disabled = true;
// 	} catch (error) {
// 		console.error('Camera access denied:', error);
// 	}
// });

// cameraSelect.addEventListener('change', async () => {
// 	const stream = await navigator.mediaDevices.getUserMedia({
// 		video: { deviceId: cameraSelect.value }
// 	});
// 	video.srcObject = stream;
// });

/* global faceLandmarksDetection */

// const video = document.getElementById("video");
// const canvas = document.getElementById("overlay");
// const ctx = canvas.getContext("2d");

// const poses = {
// 	"tongue-center": { label: "Tongue Center", desc: "Stick your tongue straight out." },
// 	"tongue-left": { label: "Tongue Left", desc: "Stick your tongue out to the left." },
// 	"tongue-right": { label: "Tongue Right", desc: "Stick your tongue out to the right." },
// 	"tongue-up": { label: "Tongue Up", desc: "Stick your tongue out upwards." },
// 	"tongue-down": { label: "Tongue Down", desc: "Stick your tongue out downwards." },
// 	"mouth-open": { label: "Mouth Open", desc: "Open your mouth without sticking out your tongue." },
// 	"mouth-closed": { label: "Mouth Closed", desc: "Keep your mouth closed, but make various facial expressions." }
// };

// let currentPoseIndex = 0;
// let model;

// const buckets = {}; // pose -> pitch -> yaw -> images

// function quantize(angle) {
// 	return Math.max(-40, Math.min(40, Math.round(angle / 10) * 10));
// }

// function estimateHeadPose(landmarks) {
// 	const leftEye = landmarks[33];
// 	const rightEye = landmarks[263];
// 	const nose = landmarks[1];

// 	const dx = rightEye.x - leftEye.x;
// 	const dy = rightEye.y - leftEye.y;

// 	const yaw = (nose.x - (leftEye.x + rightEye.x) / 2) / dx * 100;
// 	const pitch = (nose.y - (leftEye.y + rightEye.y) / 2) / dy * 100;

// 	return {
// 		yaw: quantize(yaw),
// 		pitch: quantize(pitch)
// 	};
// }

// function cropMouth(video, landmarks) {
// 	const mouth = landmarks.slice(61, 88);

// 	let minX = Infinity, minY = Infinity;
// 	let maxX = 0, maxY = 0;

// 	for (let p of mouth) {
// 		minX = Math.min(minX, p.x);
// 		minY = Math.min(minY, p.y);
// 		maxX = Math.max(maxX, p.x);
// 		maxY = Math.max(maxY, p.y);
// 	}

// 	const size = Math.max(maxX - minX, maxY - minY) * 1.5;

// 	const temp = document.createElement("canvas");
// 	temp.width = temp.height = 128;

// 	const tctx = temp.getContext("2d");
// 	tctx.drawImage(
// 		video,
// 		minX - size / 4,
// 		minY - size / 4,
// 		size,
// 		size,
// 		0,
// 		0,
// 		128,
// 		128
// 	);

// 	return new Promise(res => temp.toBlob(res));
// }

// function ensureBucket(pose, pitch, yaw) {
// 	if (!buckets[pose]) buckets[pose] = {};
// 	if (!buckets[pose][pitch]) buckets[pose][pitch] = {};
// 	if (!buckets[pose][pitch][yaw]) buckets[pose][pitch][yaw] = [];
// 	return buckets[pose][pitch][yaw];
// }

// async function loop() {
// 	const preds = await model.estimateFaces(video);

// 	if (preds.length) {
// 		const lm = preds[0].scaledMesh;

// 		const { pitch, yaw } = estimateHeadPose(lm);
// 		const pose = poses[currentPoseIndex];

// 		const bucket = ensureBucket(pose, pitch, yaw);

// 		if (bucket.length < 5) {
// 			const blob = await cropMouth(video, lm);
// 			bucket.push(blob);

// 			await db.save(pose, pitch, yaw, bucket.length, blob);
// 			updateGrid();
// 		}

// 		checkAdvance(pose);
// 	}

// 	requestAnimationFrame(loop);
// }

// function checkAdvance(pose) {
// 	const grid = buckets[pose];
// 	if (!grid) return;

// 	let allReady = true;

// 	for (let p = -40; p <= 40; p += 10) {
// 		for (let y = -40; y <= 40; y += 10) {
// 			const count = grid?.[p]?.[y]?.length || 0;
// 			if (count < 2) {
// 				allReady = false;
// 				break;
// 			}
// 		}
// 	}

// 	if (allReady && currentPoseIndex < poses.length - 1) {
// 		currentPoseIndex++;
// 		updateUI();
// 	}
// }

// function updateUI() {
// 	document.getElementById("poseLabel").innerText =
// 		"Pose: " + poses[currentPoseIndex];
// }

// function updateGrid() {
// 	const gridEl = document.getElementById("grid");
// 	gridEl.innerHTML = "";

// 	const pose = poses[currentPoseIndex];

// 	for (let p = -40; p <= 40; p += 10) {
// 		for (let y = -40; y <= 40; y += 10) {
// 			const div = document.createElement("div");
// 			div.className = "bucket";

// 			const imgs = buckets?.[pose]?.[p]?.[y] || [];

// 			imgs.forEach(blob => {
// 				const img = document.createElement("img");
// 				img.src = URL.createObjectURL(blob);
// 				div.appendChild(img);
// 			});

// 			if (imgs.length >= 2) div.classList.add("filled");

// 			gridEl.appendChild(div);
// 		}
// 	}
// }

// async function setupCamera() {
// 	const devices = await navigator.mediaDevices.enumerateDevices();
// 	const select = document.getElementById("cameraSelect");

// 	devices
// 		.filter(d => d.kind === "videoinput")
// 		.forEach(d => {
// 			const opt = document.createElement("option");
// 			opt.value = d.deviceId;
// 			opt.text = d.label || "Camera";
// 			select.appendChild(opt);
// 		});
// }

// async function startCamera() {
// 	const deviceId = document.getElementById("cameraSelect").value;

// 	const stream = await navigator.mediaDevices.getUserMedia({
// 		video: { deviceId }
// 	});

// 	video.srcObject = stream;
// }

// document.getElementById("selectFolder").onclick = () => db.selectFolder();
// document.getElementById("startCamera").onclick = startCamera;

// await setupCamera();

// model = await faceLandmarksDetection.load(
// 	faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
// );

// updateUI();
// loop();