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

for (const [poseId, pose] of Object.entries(poses)) {
	pose.id = poseId;
	pose.buckets = {};
}

const MOUTH_MESH_ANNOTATIONS = {
	lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
	lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
	lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
	lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
};

TrackyMouse.dependenciesRoot = "core";
TrackyMouse.loadDependencies().then(() => {
	init();
});
function init() {
	const trackyMouse = TrackyMouse.init(document.getElementById("tracky-mouse"));

	setInterval(() => {
		if (trackyMouse._facemeshPrediction) {
			recordSnapshot(trackyMouse._facemeshPrediction, trackyMouse._headTilt, trackyMouse._video);
		}
		trackyMouse._setPaused(true);
	}, 100);
}

let currentPose = Object.keys(poses)[0];


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
}


