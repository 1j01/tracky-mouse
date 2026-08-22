
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
let virtualJoystickSpeedRampStartTime = Infinity; // used for joystick/d-pad movement modes
let lastMouseDownTime = -Infinity;
let mouseNeedsInitPos = true;

// Other state
let paused = true;
let pointTracker;
