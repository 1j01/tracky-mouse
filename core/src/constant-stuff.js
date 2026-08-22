
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
