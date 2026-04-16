/* global TrackyMouse */

/**
 * @typedef {Object} Sample
 * @property {string} poseId
 * @property {number} pitch
 * @property {number} yaw
 * @property {number} sampleIndex
 * @property {HTMLImageElement} img
 */

/**
 * @typedef {Object} BoundingBox
 * @property {number} xMin
 * @property {number} yMin
 * @property {number} xMax
 * @property {number} yMax
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} Face
 * @property {Array<{x: number, y: number, z: number}>} keypoints
 * @property {BoundingBox} box
 */

import { TrainerDB } from "./db.js";

const db = new TrainerDB();

const mouthCanvas = document.getElementById("mouth-canvas");
const toggleRecordingButton = document.getElementById("toggle-recording");
const selectFolderButton = document.getElementById("select-folder");
const loadingProgress = document.getElementById("loading-progress");
const loadingStatus = document.getElementById("loading-status");
const cancelLoadingButton = document.getElementById("cancel-loading");

/** @type {{[key: string]: { label: string, description: string, buckets: { [key: string]: { [key: string]: { samples: Sample[], element: HTMLElement } } } }}} */
const poses = {
	"mouth-closed": { label: "Mouth Closed", description: "Keep your mouth closed, but make various facial expressions." },
	"mouth-open": { label: "Mouth Open", description: "Open your mouth without sticking out your tongue." },
	"tongue-center": { label: "Tongue Center", description: "Stick your tongue straight out." },
	"tongue-left": { label: "Tongue Left", description: "Stick your tongue out to the left." },
	"tongue-right": { label: "Tongue Right", description: "Stick your tongue out to the right." },
	"tongue-up": { label: "Tongue Up", description: "Stick your tongue out upwards." },
	"tongue-down": { label: "Tongue Down", description: "Stick your tongue out downwards." },
};

let currentPose = Object.keys(poses)[0];
let currentBucket = null;
let recording = false;
let loading = false;
let activeLoadController = null;
let recordingEnabled = false;
const maxSamplesPerBucket = 5;

const MOUTH_MESH_ANNOTATIONS = {
	lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
	lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
	lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
	lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
};

function setRecording(shouldRecord) {
	recording = shouldRecord;
	toggleRecordingButton.textContent = recording ? "Stop Recording" : "Start Recording";
	toggleRecordingButton.setAttribute("aria-pressed", recording);
}

function setRecordingEnabled(shouldEnable) {
	recordingEnabled = shouldEnable;
	toggleRecordingButton.disabled = loading || !recordingEnabled;
}

function renderLoadingUI({ isActive, phase = "scanning", entriesScanned = 0, loaded = 0, total = 0 }) {
	selectFolderButton.disabled = isActive;
	cancelLoadingButton.hidden = !isActive;
	loadingProgress.hidden = !isActive;
	if (!isActive) {
		loadingStatus.textContent = "";
		loadingProgress.removeAttribute("value");
		loadingProgress.max = 1;
		loadingProgress.value = 0;
		return;
	}
	if (phase === "scanning") {
		loadingProgress.removeAttribute("value");
		loadingStatus.textContent = `Reading folders... scanned ${entriesScanned} entries`;
		return;
	}
	loadingProgress.max = Math.max(total, 1);
	loadingProgress.value = loaded;
	loadingStatus.textContent = `Loading samples: ${loaded}/${total}`;
}

/**
 * @returns {Promise<boolean | null>} true on success, false on fatal error, null if canceled
 */
async function loadAndDisplayExistingSamples(signal) {
	try {
		const existingImageFiles = await db.load({
			signal,
			onProgress: ({ phase, entriesScanned, loaded, total }) => {
				renderLoadingUI({ isActive: true, phase, entriesScanned, loaded, total });
			},
		});
		reset(); // in case of switching folders, clear out old samples
		for (const poseId in existingImageFiles) {
			for (const pitch in existingImageFiles[poseId]) {
				for (const yaw in existingImageFiles[poseId][pitch]) {
					for (const { fileName, file } of existingImageFiles[poseId][pitch][yaw]) {
						const sample = {
							poseId,
							pitch: parseFloat(pitch),
							yaw: parseFloat(yaw),
							sampleIndex: parseInt(fileName.split(".")[0]),
							img: document.createElement("img"),
						};
						sample.img.src = URL.createObjectURL(file);
						sample.img.dataset.saveState = "saved";
						trackAndDisplaySample(sample);
					}
				}
			}
		}
		console.log("Loaded existing samples from database");
		return true;
	} catch (err) {
		if (err.name === "AbortError") {
			console.log("Loading samples canceled");
			return null;
		}
		if (err.name === "NotFoundError") {
			console.log("No existing samples found in database");
			return true;
		} else {
			console.error("Failed to load existing samples from database:", err);
			alert("Failed to load existing samples from database:\n\n" + err.message);
			return false;
		}
	}
}

async function loadSamplesForCurrentFolder() {
	if (loading) {
		return;
	}
	const loadController = new AbortController();
	const recordingWasEnabled = recordingEnabled;
	activeLoadController = loadController;
	loading = true;
	setRecording(false);
	renderLoadingUI({ isActive: true, phase: "scanning", entriesScanned: 0, loaded: 0, total: 0 });
	setRecordingEnabled(recordingWasEnabled);
	try {
		const loadResult = await loadAndDisplayExistingSamples(loadController.signal);
		if (loadResult === true) {
			setRecordingEnabled(true);
		} else {
			setRecordingEnabled(recordingWasEnabled);
		}
	} finally {
		if (activeLoadController === loadController) {
			activeLoadController = null;
		}
		loading = false;
		renderLoadingUI({ isActive: false });
		setRecordingEnabled(recordingEnabled);
	}
}

function init() {
	const trackyMouse = TrackyMouse.init(document.getElementById("tracky-mouse"));

	toggleRecordingButton.addEventListener("click", () => {
		setRecording(!recording);
	});
	window.addEventListener("blur", () => {
		setRecording(false);
	});
	setRecordingEnabled(false);

	cancelLoadingButton.addEventListener("click", () => {
		activeLoadController?.abort();
	});

	selectFolderButton.addEventListener("click", async () => {
		if (loading) {
			return;
		}
		if (!window.showDirectoryPicker) {
			alert("The File System Access API is not supported in this browser. Please use a compatible browser like Chrome or Edge.");
			return;
		}
		try {
			setRecording(false);
			await db.selectFolder();
			if (!db.rootHandle) {
				return;
			}
			loadSamplesForCurrentFolder();
		} catch (err) {
			if (err.name === "AbortError") {
				return;
			}
			console.error("Failed to select folder:", err);
			alert("Failed to select folder. Make sure you grant the necessary permissions and try again.");
		}
	});

	db.init().then((hasAccess) => {
		if (!hasAccess) {
			console.log("No access to database, user needs to select folder");
			return;
		}
		loadSamplesForCurrentFolder();
	}).catch((err) => {
		console.error("Failed to initialize database:", err);
		alert("Failed to access the database:\n\n" + err.message);
	});

	setInterval(() => {
		if (trackyMouse._facemeshPrediction) {
			recordSnapshot(trackyMouse._facemeshPrediction, trackyMouse._headTilt, trackyMouse._video);
		}
		trackyMouse._setPaused(true);
	}, 100);
}


for (const [poseId, pose] of Object.entries(poses)) {
	pose.id = poseId;
	pose.buckets = {};
	const li = document.createElement("li");
	li.textContent = pose.label;
	li.title = pose.description;
	li.classList.toggle("selected", poseId === currentPose);
	document.getElementById("poses-list").appendChild(li);
	li.addEventListener("click", () => {
		currentPose = poseId;
		for (const el of document.querySelectorAll("#poses-list li")) {
			el.classList.toggle("selected", el === li);
		}
		for (const el of document.querySelectorAll(".bucket")) {
			el.style.display = el.dataset.poseId === currentPose ? "" : "none";
		}
	});
}

function reset() {
	for (const pose of Object.values(poses)) {
		pose.buckets = {};
	}
	document.getElementById("samples-grid").innerHTML = "";
}


/**
 * @param {{pitch: number, yaw: number}} headTilt in radians
 * @returns {{pitch: number, yaw: number}} quantized angles in degrees
 */
function headTiltToBucket(headTilt) {
	const maxYaw = 40; // degrees
	const maxPitch = 40; // degrees
	const yawBucketCount = 9;
	const pitchBucketCount = 9;
	return {
		yaw: clampAndSnap(headTilt.yaw * (180 / Math.PI), -maxYaw, maxYaw, yawBucketCount),
		pitch: clampAndSnap(headTilt.pitch * (180 / Math.PI), -maxPitch, maxPitch, pitchBucketCount)
	};
}

function clampAndSnap(value, min, max, bucketCount) {
	const range = max - min;
	const quantized = min + Math.round(((value - min) / range) * (bucketCount - 1)) * (range / (bucketCount - 1));
	return Math.max(min, Math.min(max, quantized));
}

/**
 * @param {HTMLVideoElement} video 
 * @param {Face} facemeshPrediction 
 */
function captureMouthImage(video, facemeshPrediction) {
	/** @type {BoundingBox} */
	const mouthBoundingBox = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity, width: -Infinity, height: -Infinity };
	for (const part of Object.values(MOUTH_MESH_ANNOTATIONS)) {
		for (const index of part) {
			const { x, y } = facemeshPrediction.keypoints[index];
			if (x < mouthBoundingBox.xMin) mouthBoundingBox.xMin = x;
			if (x > mouthBoundingBox.xMax) mouthBoundingBox.xMax = x;
			if (y < mouthBoundingBox.yMin) mouthBoundingBox.yMin = y;
			if (y > mouthBoundingBox.yMax) mouthBoundingBox.yMax = y;
		}
	}
	mouthBoundingBox.width = mouthBoundingBox.xMax - mouthBoundingBox.xMin;
	mouthBoundingBox.height = mouthBoundingBox.yMax - mouthBoundingBox.yMin;
	const mouthCenterX = mouthBoundingBox.xMin + mouthBoundingBox.width / 2;
	const mouthCenterY = mouthBoundingBox.yMin + mouthBoundingBox.height / 2;
	const paddingFraction = 0.5;
	const captureSize = Math.max(mouthBoundingBox.width, mouthBoundingBox.height) * (1 + 2 * paddingFraction);
	// TODO: normalize by head size
	/** @type {BoundingBox} */
	const captureBox = {
		xMin: mouthCenterX - captureSize / 2,
		yMin: mouthCenterY - captureSize / 2,
		xMax: mouthCenterX + captureSize / 2,
		yMax: mouthCenterY + captureSize / 2,
		width: captureSize,
		height: captureSize,
	};

	const ctx = mouthCanvas.getContext("2d");
	ctx.clearRect(0, 0, mouthCanvas.width, mouthCanvas.height);
	ctx.drawImage(
		video,
		captureBox.xMin,
		captureBox.yMin,
		captureBox.width,
		captureBox.height,
		0,
		0,
		mouthCanvas.width,
		mouthCanvas.height
	);
}

/**
 * @param {Sample} sample 
 */
function trackAndDisplaySample(sample) {
	const pose = poses[sample.poseId];
	if (!pose.buckets[sample.pitch]) {
		pose.buckets[sample.pitch] = {};
	}
	let bucket = pose.buckets[sample.pitch][sample.yaw];
	if (!bucket) {
		bucket = pose.buckets[sample.pitch][sample.yaw] = {
			samples: [],
			element: document.createElement("div"),
		};
		document.getElementById("samples-grid").append(bucket.element);
		bucket.element.classList.add("bucket");
		bucket.element.dataset.count = "0";
		bucket.element.dataset.pitch = sample.pitch;
		bucket.element.dataset.yaw = sample.yaw;
		bucket.element.dataset.poseId = sample.poseId;
		bucket.element.style.setProperty("--pitch", `${-sample.pitch}deg`);
		bucket.element.style.setProperty("--yaw", `${-sample.yaw}deg`);
		bucket.element.style.display = sample.poseId === currentPose ? "" : "none";
	}

	bucket.samples.push(sample);
	sample.img.width = 50;
	sample.img.height = 50;
	sample.img.style.setProperty("--sample-index", bucket.samples.length);
	bucket.element.appendChild(sample.img);
	bucket.element.dataset.count = bucket.samples.length;
	bucket.element.style.setProperty("--count", bucket.samples.length);

}

/**
 * @param {Face} facemeshPrediction 
 * @param {{pitch: number, yaw: number, roll: number}} headTilt 
 * @param {HTMLVideoElement} video 
 */
function recordSnapshot(facemeshPrediction, headTilt, video) {
	captureMouthImage(video, facemeshPrediction);
	const bucketAngles = headTiltToBucket(headTilt);
	const pose = poses[currentPose];
	if (!pose.buckets[bucketAngles.pitch]) {
		pose.buckets[bucketAngles.pitch] = {};
	}
	const existingBucket = pose.buckets[bucketAngles.pitch][bucketAngles.yaw];

	if (recording && (!existingBucket || existingBucket.samples.length < maxSamplesPerBucket)) {
		/** @type {Sample} */
		const sample = {
			poseId: currentPose,
			pitch: bucketAngles.pitch,
			yaw: bucketAngles.yaw,
			sampleIndex: existingBucket?.samples?.length ?? 0,
			img: document.createElement("img"),
		};
		mouthCanvas.toBlob((blob) => {
			// TODO: display instantly instead of waiting for the blob to be created
			sample.img.src = URL.createObjectURL(blob);
			db.save(sample.poseId, sample.pitch, sample.yaw, sample.sampleIndex, blob).then(() => {
				sample.img.dataset.saveState = "saved";
			}).catch((err) => {
				console.error("Failed to save sample:", err);
				sample.img.dataset.saveState = "error";
			});
		});
		trackAndDisplaySample(sample);
	}

	currentBucket?.element.classList.remove("current");
	currentBucket = pose.buckets[bucketAngles.pitch][bucketAngles.yaw];
	currentBucket?.element.classList.add("current");
}


TrackyMouse.dependenciesRoot = "core";
TrackyMouse.loadDependencies().then(() => {
	init();
});
