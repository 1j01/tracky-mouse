/* global TrackyMouse */
import { TrainerDB } from "./db.js";

const db = new TrainerDB();

const poses = {
	"tongue-center": { label: "Tongue Center", description: "Stick your tongue straight out." },
	"tongue-left": { label: "Tongue Left", description: "Stick your tongue out to the left." },
	"tongue-right": { label: "Tongue Right", description: "Stick your tongue out to the right." },
	"tongue-up": { label: "Tongue Up", description: "Stick your tongue out upwards." },
	"tongue-down": { label: "Tongue Down", description: "Stick your tongue out downwards." },
	"mouth-open": { label: "Mouth Open", description: "Open your mouth without sticking out your tongue." },
	"mouth-closed": { label: "Mouth Closed", description: "Keep your mouth closed, but make various facial expressions." }
};

let currentPose = Object.keys(poses)[0];

const MOUTH_MESH_ANNOTATIONS = {
	lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
	lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
	lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
	lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
};

function init() {
	const trackyMouse = TrackyMouse.init(document.getElementById("tracky-mouse"));

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
	return { column, row, yaw, pitch };

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

	const mouthCanvas = document.getElementById("mouth-canvas");
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
		bucket.element.style.setProperty("--pitch", `${bucketAngles.pitch}deg`);
		bucket.element.style.setProperty("--yaw", `${bucketAngles.yaw}deg`);
	}

	if (bucket.samples.length < 5) {
		const sample = {
			blobPromise: new Promise((resolve) => {
				mouthCanvas.toBlob((blob) => {
					resolve(blob);
					// TODO: display instantly instead of waiting for the blob to be created
					sample.img.src = URL.createObjectURL(blob);
				});
			}),
			timestamp: Date.now(),
			img: document.createElement("img"),
		};
		bucket.samples.push(sample);
		sample.img.width = 50;
		sample.img.height = 50;
		bucket.element.appendChild(sample.img);
		bucket.element.dataset.count = bucket.samples.length;
	}

}


TrackyMouse.dependenciesRoot = "core";
TrackyMouse.loadDependencies().then(() => {
	init();
});
