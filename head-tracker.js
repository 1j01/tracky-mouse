var mirrorCheckbox = document.getElementById("mirror");
var sensitivityXSlider = document.getElementById("sensitivity-x");
var sensitivityYSlider = document.getElementById("sensitivity-y");

var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

var mouseEl = document.createElement('div');
mouseEl.className = "mouse";
document.body.appendChild(mouseEl);

var cameraVideo = document.createElement('video');
// required to work in iOS 11 & up:
cameraVideo.setAttribute('playsinline', '');

var w = 640;
var h = 480;
var maxPoints = 1000;
var mouseX = 0;
var mouseY = 0;
var prevMovementX = 0;
var prevMovementY = 0;
// var movementXSinceFacemeshUpdate = 0;
// var movementYSinceFacemeshUpdate = 0;
var cameraFramesSinceFacemeshUpdate = [];
var sensitivityX;
var sensitivityY;
var face;
var faceScore = 0;
var faceScoreThreshold = 0.5;
var pointsBasedOnFaceScore = 0;
const SLOWMO = false;
var mirror;

var useClmtrackr = true;
var showClmtrackr = useClmtrackr;
var useFacemesh = true;
var facemeshOptions = {
	maxContinuousChecks: 5,
	detectionConfidence: 0.9,
	maxFaces: 1,
	iouThreshold: 0.3,
	scoreThreshold: 0.75
};

var facemeshLoaded = false;
var facemeshEstimating = false;
var facemeshPrediction;
var facemeshEstimateFaces;
var faceInViewConfidenceThreshold = 0.7;
var pointsBasedOnFaceInViewConfidence = 0;

const frameCanvas = document.createElement("canvas");
const frameCtx = frameCanvas.getContext("2d");
const getCameraImageData = () => {
	frameCanvas.width = cameraVideo.videoWidth;
	frameCanvas.height = cameraVideo.videoHeight;
	frameCtx.drawImage(cameraVideo, 0, 0);
	return frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
};

if (useFacemesh) {
	facemeshWorker = new Worker("./facemesh.worker.js");
	facemeshWorker.addEventListener("message", (e) => {
		// console.log('Message received from worker', e.data);
		if (e.data.type === "LOADED") {
			facemeshLoaded = true;
			facemeshEstimateFaces = () => {
				const imageData = getCameraImageData();
				facemeshWorker.postMessage({ type: "ESTIMATE_FACES", imageData });
				return new Promise((resolve, reject) => {
					facemeshWorker.addEventListener("message", (e) => {
						if (e.data.type === "ESTIMATED_FACES") {
							resolve(e.data.predictions);
						}
					}, { once: true });
				});
			};
		}
	}, { once: true });
	facemeshWorker.postMessage({ type: "LOAD", options: facemeshOptions });
};

sensitivityXSlider.onchange = () => {
	sensitivityX = sensitivityXSlider.value / 1000;
};
sensitivityYSlider.onchange = () => {
	sensitivityY = sensitivityYSlider.value / 1000;
};
mirrorCheckbox.onchange = () => {
	mirror = mirrorCheckbox.checked;
};
mirrorCheckbox.onchange();
sensitivityXSlider.onchange();
sensitivityYSlider.onchange();

var ctrack = new clm.tracker();
ctrack.init();
var trackingStarted = false;

if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
	console.log('getUserMedia not supported in this browser');
}

navigator.mediaDevices.getUserMedia({
	audio: false,
	video: {
		width: w,
		height: h
	}
}).then((stream) => {
	try {
		if ('srcObject' in cameraVideo) {
			cameraVideo.srcObject = stream;
		} else {
			cameraVideo.src = window.URL.createObjectURL(stream);
		}
	} catch (err) {
		cameraVideo.src = stream;
	}
}, (error) => {
	console.log(error);
});

cameraVideo.addEventListener('loadedmetadata', () => {
	cameraVideo.play();
	cameraVideo.width = cameraVideo.videoWidth;
	cameraVideo.height = cameraVideo.videoHeight;

	console.log('capture ready.');
});
cameraVideo.addEventListener('canplay', () => {
	ctrack.initFaceDetector(cameraVideo);
	trackingStarted = true;
});

canvas.width = w;
canvas.height = h;
cameraVideo.width = w;
cameraVideo.height = h;

// Object Oriented Programming Sucks
// or Optical flOw Points System
class OOPS {
	constructor() {
		this.curPyramid = new jsfeat.pyramid_t(3);
		this.prevPyramid = new jsfeat.pyramid_t(3);
		this.curPyramid.allocate(w, h, jsfeat.U8C1_t);
		this.prevPyramid.allocate(w, h, jsfeat.U8C1_t);

		this.pointCount = 0;
		this.pointStatus = new Uint8Array(maxPoints);
		this.prevXY = new Float32Array(maxPoints * 2);
		this.curXY = new Float32Array(maxPoints * 2);
	}
	addPoint(x, y) {
		if (this.pointCount < maxPoints) {
			var pointIndex = this.pointCount * 2;
			this.curXY[pointIndex] = x;
			this.curXY[pointIndex + 1] = y;
			this.prevXY[pointIndex] = x;
			this.prevXY[pointIndex + 1] = y;
			this.pointCount++;
		}
	}
	filterPoints(condition) {
		var outputPointIndex = 0;
		for (var inputPointIndex = 0; inputPointIndex < this.pointCount; inputPointIndex++) {
			if (condition(inputPointIndex)) {
				if (outputPointIndex < inputPointIndex) {
					var inputOffset = inputPointIndex * 2;
					var outputOffset = outputPointIndex * 2;
					this.curXY[outputOffset] = this.curXY[inputOffset];
					this.curXY[outputOffset + 1] = this.curXY[inputOffset + 1];
					this.prevXY[outputOffset] = this.prevXY[inputOffset];
					this.prevXY[outputOffset + 1] = this.prevXY[inputOffset + 1];
				}
				outputPointIndex++;
			}
		}
		this.pointCount = outputPointIndex;
	}
	prunePoints() {
		// pointStatus is only valid (indices line up) before filtering occurs, so must come first, and be separate
		this.filterPoints((pointIndex) => this.pointStatus[pointIndex] == 1);

		// TODO: de-duplicate points that have collapsed together
		// this.filterPoints((pointIndex) => {
		// 	var pointOffset = pointIndex * 2;
		// 	// so I need to interate over the other points here, will that be a problem?
		// });
	}
	update(imageData) {
		var xyswap = this.prevXY;
		this.prevXY = this.curXY;
		this.curXY = xyswap;
		var pyrswap = this.prevPyramid;
		this.prevPyramid = this.curPyramid;
		this.curPyramid = pyrswap;

		// these are options worth breaking out and exploring
		var winSize = 20;
		var maxIterations = 30;
		var epsilon = 0.01;
		var minEigen = 0.001;

		jsfeat.imgproc.grayscale(imageData.data, imageData.width, imageData.height, this.curPyramid.data[0]);
		this.curPyramid.build(this.curPyramid.data[0], true);
		jsfeat.optical_flow_lk.track(
			this.prevPyramid, this.curPyramid,
			this.prevXY, this.curXY,
			this.pointCount,
			winSize, maxIterations,
			this.pointStatus,
			epsilon, minEigen);
		this.prunePoints();
	}
}

var mainOops = new OOPS();
if (useFacemesh) {
	var workerSyncedOops = new OOPS();
}

canvas.addEventListener('click', (event) => {
	if (mirror) {
		mainOops.addPoint(canvas.offsetWidth - event.offsetX, event.offsetY);
	} else {
		mainOops.addPoint(event.offsetX, event.offsetY);
	}
});

function maybeAddPoint(oops, x, y) {
	for (var pointIndex = 0; pointIndex < oops.pointCount; pointIndex++) {
		var pointOffset = pointIndex * 2;
		var distance = Math.hypot(
			x - oops.curXY[pointOffset],
			y - oops.curXY[pointOffset + 1]
		);
		// If it's useful to have this higher, it should probably be based on the size of the face
		if (distance < 8) {
			return;
		}
	}
	oops.addPoint(x, y);
}

function animate() {
	requestAnimationFrame(animate);
	draw(!SLOWMO);
}

function draw(update = true) {
	ctx.resetTransform(); // in case there is an error, don't flip constantly back and forth due to mirroring
	ctx.save();
	ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	if (mirror) {
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
		ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
	}

	if (update) {
		if (trackingStarted) {
			if (useClmtrackr || showClmtrackr) {
				ctrack.track(cameraVideo);
				face = ctrack.getCurrentPosition();
				faceScore = ctrack.getScore();
			}
			if (facemeshLoaded && !facemeshEstimating) {
				facemeshEstimating = true;
				// movementXSinceFacemeshUpdate = 0;
				// movementYSinceFacemeshUpdate = 0;
				cameraFramesSinceFacemeshUpdate = [];
				facemeshEstimateFaces().then((predictions) => {
					const prevFaceInViewConfidence = facemeshPrediction ? facemeshPrediction.faceInViewConfidence : 0;
					facemeshPrediction = predictions[0]; // may be undefined
					facemeshEstimating = false;
					useClmtrackr = false;
					showClmtrackr = false;

					if (!facemeshPrediction) {
						return;
					}
					// time travel latency compensation
					// keep a history of camera frames since the prediciton was requested,
					// and analyze optical flow of new points over that history

					workerSyncedOops.filterPoints(()=> false); // empty points (could probably also just set pointCount = 0;

					const { annotations } = facemeshPrediction;
					// nostrils
					workerSyncedOops.addPoint(annotations.noseLeftCorner[0][0], annotations.noseLeftCorner[0][1]);
					workerSyncedOops.addPoint(annotations.noseRightCorner[0][0], annotations.noseRightCorner[0][1]);
					// midway between eyes
					workerSyncedOops.addPoint(annotations.midwayBetweenEyes[0][0], annotations.midwayBetweenEyes[0][1]);
					// inner eye corners
					// workerSyncedOops.addPoint(annotations.leftEyeLower0[8][0], annotations.leftEyeLower0[8][1]);
					// workerSyncedOops.addPoint(annotations.rightEyeLower0[8][0], annotations.rightEyeLower0[8][1]);

					cameraFramesSinceFacemeshUpdate.forEach((imageData) => {
						workerSyncedOops.update(imageData);
					});

					for (var pointIndex = 0; pointIndex < workerSyncedOops.pointCount; pointIndex++) {
						const pointOffset = pointIndex * 2;
						maybeAddPoint(mainOops, workerSyncedOops.curXY[pointOffset], workerSyncedOops.curXY[pointOffset + 1]);
					}

					// naive latency compensation
					// Note: this applies to facemeshPrediction.annotations as well which references the same point objects
					// Note: This latency compensation only really works if it's already tracking well
					// if (prevFaceInViewConfidence > 0.99) {
					// 	facemeshPrediction.scaledMesh.forEach((point) => {
					// 		point[0] += movementXSinceFacemeshUpdate;
					// 		point[1] += movementYSinceFacemeshUpdate;
					// 	});
					// }

					pointsBasedOnFaceInViewConfidence = facemeshPrediction.faceInViewConfidence;

					// TODO: separate confidence threshold for removing vs adding points?

					// cull points to those within useful facial region
					// TODO: use time travel for this too, probably! with a history of the points
					// a complexity would be that points can be removed over time and we need to keep them identified
					mainOops.filterPoints((pointIndex) => {
						var pointOffset = pointIndex * 2;
						// distance from tip of nose (stretched so make an ellipse taller than wide)
						var distance = Math.hypot(
							(annotations.noseTip[0][0] - mainOops.curXY[pointOffset]) * 1.4,
							annotations.noseTip[0][1] - mainOops.curXY[pointOffset + 1]
						);
						var headSize = Math.hypot(
							annotations.leftCheek[0][0] - annotations.rightCheek[0][0],
							annotations.leftCheek[0][1] - annotations.rightCheek[0][1]
						);
						if (distance > headSize) {
							return false;
						}
						// Avoid blinking eyes affecting pointer position.
						// distance to outer corners of eyes
						distance = Math.min(
							Math.hypot(
								annotations.leftEyeLower0[0][0] - mainOops.curXY[pointOffset],
								annotations.leftEyeLower0[0][1] - mainOops.curXY[pointOffset + 1]
							),
							Math.hypot(
								annotations.rightEyeLower0[0][0] - mainOops.curXY[pointOffset],
								annotations.rightEyeLower0[0][1] - mainOops.curXY[pointOffset + 1]
							),
						);
						if (distance < headSize * 0.42) {
							return false;
						}
						return true;
					});
				}, () => {
					facemeshEstimating = false;
				});
			}
		}
		mainOops.update(imageData);
	}

	if (facemeshPrediction) {
		ctx.fillStyle = "red";

		const bad = facemeshPrediction.faceInViewConfidence < faceInViewConfidenceThreshold;
		ctx.fillStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
		if (!bad || mainOops.pointCount < 3 || facemeshPrediction.faceInViewConfidence > pointsBasedOnFaceInViewConfidence + 0.05) {
			if (bad) {
				ctx.fillStyle = 'rgba(255,0,255)';
			}
			if (update && useFacemesh) {
				// this should just be visual, since we only add/remove points based on the facemesh data when receiving it
				facemeshPrediction.scaledMesh.forEach((point) => {
					point[0] += prevMovementX;
					point[1] += prevMovementY;
				});
			}
			facemeshPrediction.scaledMesh.forEach(([x, y, z]) => {
				ctx.fillRect(x, y, 1, 1);
			});
		} else {
			if (update && useFacemesh) {
				pointsBasedOnFaceInViewConfidence -= 0.001;
			}
		}
	}

	if (face) {
		const bad = faceScore < faceScoreThreshold;
		ctx.strokeStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
		if (!bad || mainOops.pointCount < 2 || faceScore > pointsBasedOnFaceScore + 0.05) {
			if (bad) {
				ctx.strokeStyle = 'rgba(255,0,255)';
			}
			if (update && useClmtrackr) {
				pointsBasedOnFaceScore = faceScore;

				// nostrils
				maybeAddPoint(mainOops, face[42][0], face[42][1]);
				maybeAddPoint(mainOops, face[43][0], face[43][1]);
				// inner eye corners
				// maybeAddPoint(mainOops, face[25][0], face[25][1]);
				// maybeAddPoint(mainOops, face[30][0], face[30][1]);

				// TODO: separate confidence threshold for removing vs adding points?

				// cull points to those within useful facial region
				mainOops.filterPoints((pointIndex) => {
					var pointOffset = pointIndex * 2;
					// distance from tip of nose (stretched so make an ellipse taller than wide)
					var distance = Math.hypot(
						(face[62][0] - mainOops.curXY[pointOffset]) * 1.4,
						face[62][1] - mainOops.curXY[pointOffset + 1]
					);
					// distance based on outer eye corners
					var headSize = Math.hypot(
						face[23][0] - face[28][0],
						face[23][1] - face[28][1]
					);
					if (distance > headSize) {
						return false;
					}
					return true;
				});
			}
		} else {
			if (update && useClmtrackr) {
				pointsBasedOnFaceScore -= 0.001;
			}
		}
		if (showClmtrackr) {
			ctrack.draw(canvas, undefined, undefined, true);
		}
	}
	var movementX = 0;
	var movementY = 0;
	var numMovements = 0;
	for (var i = 0; i < mainOops.pointCount; i++) {
		var pointOffset = i * 2;
		var distMoved = Math.hypot(
			mainOops.prevXY[pointOffset] - mainOops.curXY[pointOffset],
			mainOops.prevXY[pointOffset + 1] - mainOops.curXY[pointOffset + 1]
		);
		if (distMoved >= 1) {
			ctx.fillStyle = "lime";
		} else {
			ctx.fillStyle = "gray";
		}
		movementX += mainOops.curXY[pointOffset] - mainOops.prevXY[pointOffset];
		movementY += mainOops.curXY[pointOffset + 1] - mainOops.prevXY[pointOffset + 1];
		numMovements += 1;
		circle(mainOops.curXY[pointOffset], mainOops.curXY[pointOffset + 1], 3);
	}
	if (numMovements > 0) {
		movementX /= numMovements;
		movementY /= numMovements;
	}
	if (update) {
		mouseX -= movementX * sensitivityX * innerWidth;
		mouseY += movementY * sensitivityY * innerHeight;

		mouseX = Math.min(Math.max(0, mouseX), innerWidth);
		mouseY = Math.min(Math.max(0, mouseY), innerHeight);

		mouseEl.style.left = `${mouseX}px`;
		mouseEl.style.top = `${mouseY}px`;

		prevMovementX = movementX;
		prevMovementY = movementY;
		// movementXSinceFacemeshUpdate += movementX;
		// movementYSinceFacemeshUpdate += movementY;
		if (facemeshEstimating) {
			cameraFramesSinceFacemeshUpdate.push(getCameraImageData());
			// limit this buffer size in case something goes wrong
			if (cameraFramesSinceFacemeshUpdate.length > 500) {
				// maybe just clear it entirely, because a partial buffer might not be useful
				cameraFramesSinceFacemeshUpdate.length = 0;
			}
		}
	}
	ctx.restore();

	ctx.save();
	ctx.fillStyle = "#fff";
	ctx.strokeStyle = "#000";
	ctx.lineWidth = 3;
	ctx.font = "20px sans-serif";
	ctx.beginPath();
	const text1 = "Face tracking score: " + ((useFacemesh && facemeshPrediction) ? facemeshPrediction.faceInViewConfidence : faceScore).toFixed(4);
	const text2 = "Points based on score: " + ((useFacemesh && facemeshPrediction) ? pointsBasedOnFaceInViewConfidence : pointsBasedOnFaceScore).toFixed(4);
	ctx.strokeText(text1, 50, 50);
	ctx.fillText(text1, 50, 50);
	ctx.strokeText(text2, 50, 70);
	ctx.fillText(text2, 50, 70);
	ctx.stroke();
	ctx.fill();
	ctx.restore();
}

function circle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

animate();
if (SLOWMO) {
	setInterval(draw, 200);
}
