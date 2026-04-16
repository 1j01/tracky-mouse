/* global TrackyMouse */
import { TrainerDB } from "./db.js";

const db = new TrainerDB();

const mouthCanvas = document.getElementById("mouth-canvas");
const toggleRecordingButton = document.getElementById("toggle-recording");
const selectFolderButton = document.getElementById("select-folder");

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
const maxSamplesPerBucket = 5;

const MOUTH_MESH_ANNOTATIONS = {
	lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
	lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
	lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
	lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
};

function enableRecording() {
	if (!toggleRecordingButton.hasAttribute("disabled")) {
		return;
	}
	toggleRecordingButton.removeAttribute("disabled");
	toggleRecordingButton.addEventListener("click", () => {
		recording = !recording;
		toggleRecordingButton.textContent = recording ? "Stop Recording" : "Start Recording";
		toggleRecordingButton.setAttribute("aria-pressed", recording);
	});
}

function init() {
	const trackyMouse = TrackyMouse.init(document.getElementById("tracky-mouse"));

	selectFolderButton.addEventListener("click", async () => {
		if (!window.showDirectoryPicker) {
			alert("The File System Access API is not supported in this browser. Please use a compatible browser like Chrome or Edge.");
			return;
		}
		try {
			await db.selectFolder();
			if (!db.rootHandle) {
				// alert("Folder selection was cancelled or failed. Please try again.");
				return;
			}
			// alert("Folder selected successfully! You can now start recording samples.");
			enableRecording();
		} catch (err) {
			console.error("Failed to select folder:", err);
			alert("Failed to select folder. Make sure you grant the necessary permissions and try again.");
		}
	});

	// addEventListener("click", () => {
	db.init().then((hasAccess) => {
		if (!hasAccess) {
			console.log("No access to database, user needs to select folder");
			// alert("Please select a folder to store the training data.");
			return;
		}
		// db.load(); // TODO: load existing images
		enableRecording();
	}).catch((err) => {
		console.error("Failed to initialize database:", err);
		alert("Failed to access the database:\n\n" + err.message);
	});
	// }, { once: true });

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
	});
}

function headTiltToBucket(headTilt) {
	const maxYaw = 40; // degrees
	const maxPitch = 40; // degrees
	const yawBucketCount = 9;
	const pitchBucketCount = 9;

	const yaw = Math.max(-maxYaw, Math.min(maxYaw, headTilt.yaw * 180 / Math.PI));
	const pitch = Math.max(-maxPitch, Math.min(maxPitch, headTilt.pitch * 180 / Math.PI));
	const column = Math.floor(((yaw + maxYaw) / (2 * maxYaw)) * yawBucketCount);
	const row = Math.floor(((pitch + maxPitch) / (2 * maxPitch)) * pitchBucketCount);
	return { column, row, yaw: -maxYaw + (column * (2 * maxYaw) / (yawBucketCount - 1)), pitch: -maxPitch + (row * (2 * maxPitch) / (pitchBucketCount - 1)) };

}

function recordSnapshot(facemeshPrediction, headTilt, video) {
	const mouthBoundingBox = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
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
	mouthBoundingBox.centerX = mouthBoundingBox.xMin + mouthBoundingBox.width / 2;
	mouthBoundingBox.centerY = mouthBoundingBox.yMin + mouthBoundingBox.height / 2;
	const paddingFraction = 0.5;
	const captureSize = Math.max(mouthBoundingBox.width, mouthBoundingBox.height) * (1 + 2 * paddingFraction);
	// TODO: normalize by head size
	const captureBox = {
		// x: mouthBoundingBox.xMin - mouthBoundingBox.width * paddingFraction,
		// y: mouthBoundingBox.yMin - mouthBoundingBox.height * paddingFraction,
		// width: mouthBoundingBox.width * (1 + 2 * paddingFraction),
		// height: mouthBoundingBox.height * (1 + 2 * paddingFraction),
		width: captureSize,
		height: captureSize,
		x: mouthBoundingBox.centerX - captureSize / 2,
		y: mouthBoundingBox.centerY - captureSize / 2,
	};

	const ctx = mouthCanvas.getContext("2d");
	ctx.clearRect(0, 0, mouthCanvas.width, mouthCanvas.height);
	ctx.drawImage(
		video,
		captureBox.x,
		captureBox.y,
		captureBox.width,
		captureBox.height,
		0,
		0,
		mouthCanvas.width,
		mouthCanvas.height
	);

	const bucketAngles = headTiltToBucket(headTilt);
	const pose = poses[currentPose];
	if (!pose.buckets[bucketAngles.column]) {
		pose.buckets[bucketAngles.column] = {};
	}
	let bucket = pose.buckets[bucketAngles.column][bucketAngles.row];
	if (!bucket) {
		bucket = pose.buckets[bucketAngles.column][bucketAngles.row] = {
			samples: [],
			element: document.createElement("div"),
		};
		document.getElementById("samples-grid").append(bucket.element);
		// bucket.element.style.transform = `translateZ(500px) rotateY(${bucketAngles.pitch}deg) rotateZ(${bucketAngles.yaw}deg)`;
		bucket.element.classList.add("bucket");
		bucket.element.dataset.count = "0";
		bucket.element.dataset.column = bucketAngles.column;
		bucket.element.dataset.row = bucketAngles.row;
		bucket.element.dataset.pitch = bucketAngles.pitch;
		bucket.element.dataset.yaw = bucketAngles.yaw;
		bucket.element.style.setProperty("--column", `${bucketAngles.column}`);
		bucket.element.style.setProperty("--row", `${bucketAngles.row}`);
		bucket.element.style.setProperty("--pitch", `${-bucketAngles.pitch}deg`);
		bucket.element.style.setProperty("--yaw", `${-bucketAngles.yaw}deg`);
	}

	if (bucket.samples.length < maxSamplesPerBucket && recording) {
		const sample = {
			poseId: currentPose,
			pitch: bucketAngles.pitch,
			yaw: bucketAngles.yaw,
			ordinal: bucket.samples.length,
			blobPromise: new Promise((resolve) => {
				mouthCanvas.toBlob((blob) => {
					resolve(blob);
					// TODO: display instantly instead of waiting for the blob to be created
					sample.img.src = URL.createObjectURL(blob);
					db.save(sample.poseId, sample.pitch, sample.yaw, sample.ordinal, blob).then(() => {
						sample.img.dataset.saveState = "saved";
					}).catch((err) => {
						console.error("Failed to save sample:", err);
						sample.img.dataset.saveState = "error";
					});
				});
			}),
			timestamp: Date.now(),
			img: document.createElement("img"),
		};
		bucket.samples.push(sample);
		sample.img.width = 50;
		sample.img.height = 50;
		// sample.img.dataset.ordinal = bucket.samples.length;
		sample.img.style.setProperty("--ordinal", bucket.samples.length);
		bucket.element.appendChild(sample.img);
		bucket.element.dataset.count = bucket.samples.length;
		bucket.element.style.setProperty("--count", bucket.samples.length);
	}

	if (currentBucket) {
		currentBucket.element.classList.remove("current");
	}

	currentBucket = bucket;

	currentBucket.element.classList.add("current");
}


TrackyMouse.dependenciesRoot = "core";
TrackyMouse.loadDependencies().then(() => {
	init();
});
