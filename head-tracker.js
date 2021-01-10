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

var curPyramid, prevPyramid, pointCount, pointStatus, prevXY, curXY;
var w = 640;
var h = 480;
var maxPoints = 1000;
var mouseX = 0;
var mouseY = 0;
// var prevMovementX = 0;
// var prevMovementY = 0;
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
var facemeshPredictionIsFresh = false;
var facemeshEstimateFaces;
var faceInViewConfidenceThreshold = 0.7;
var pointsBasedOnFaceInViewConfidence = 0;

if (useFacemesh) {
	facemeshWorker = new Worker("./facemesh.worker.js");
	facemeshWorker.addEventListener("message", (e)=> {
		// console.log('Message received from worker', e.data);
		if (e.data.type === "LOADED") {
			facemeshLoaded = true;
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext('2d');
			facemeshEstimateFaces = (videoElement)=> {
				canvas.width = videoElement.videoWidth;
				canvas.height = videoElement.videoHeight;
				ctx.drawImage(videoElement, 0, 0);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				facemeshWorker.postMessage({type: "ESTIMATE_FACES", imageData});
				return new Promise((resolve, reject)=> {
					facemeshWorker.addEventListener("message", (e)=> {
						if (e.data.type === "ESTIMATED_FACES") {
							resolve(e.data.predictions);
						}
					}, {once: true});
				});
			};
		}
	}, {once: true});
	facemeshWorker.postMessage({type: "LOAD", options: facemeshOptions});
};

sensitivityXSlider.onchange = ()=> {
	sensitivityX = sensitivityXSlider.value / 1000;
};
sensitivityYSlider.onchange = ()=> {
	sensitivityY = sensitivityYSlider.value / 1000;
};
mirrorCheckbox.onchange = ()=> {
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
}).then(function (stream) {
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

cameraVideo.addEventListener('loadedmetadata', function () {
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

curPyramid = new jsfeat.pyramid_t(3);
prevPyramid = new jsfeat.pyramid_t(3);
curPyramid.allocate(w, h, jsfeat.U8C1_t);
prevPyramid.allocate(w, h, jsfeat.U8C1_t);

pointCount = 0;
pointStatus = new Uint8Array(maxPoints);
prevXY = new Float32Array(maxPoints * 2);
curXY = new Float32Array(maxPoints * 2);

// function keyPressed(key) {
// 	for (var i = 0; i < 100; i++) {
// 		addPoint(random(width), random(height));
// 	}
// }

canvas.addEventListener('click', (event) => {
	if (mirror) {
		addPoint(canvas.offsetWidth - event.offsetX, event.offsetY);
	} else {
		addPoint(event.offsetX, event.offsetY);
	}
});

function addPoint(x, y) {
	if (pointCount < maxPoints) {
		var pointIndex = pointCount * 2;
		curXY[pointIndex] = x;
		curXY[pointIndex + 1] = y;
		prevXY[pointIndex] = x;
		prevXY[pointIndex + 1] = y;
		pointCount++;
	}
}

function maybeAddPoint(x, y) {
	for (var pointIndex = 0; pointIndex < pointCount; pointIndex++) {
		var pointOffset = pointIndex * 2;
		var distance = Math.hypot(x - curXY[pointOffset], y - curXY[pointOffset + 1]);
		// If its' useful to have this higher, it should probably be based on the size of the face
		if (distance < 8) {
			return;
		}
	}
	addPoint(x, y);
}

function filterPoints(condition) {
	var outputPointIndex = 0;
	for (var inputPointIndex = 0; inputPointIndex < pointCount; inputPointIndex++) {
		if (condition(inputPointIndex)) {
			if (outputPointIndex < inputPointIndex) {
				var inputOffset = inputPointIndex * 2;
				var outputOffset = outputPointIndex * 2;
				curXY[outputOffset] = curXY[inputOffset];
				curXY[outputOffset + 1] = curXY[inputOffset + 1];
				prevXY[outputOffset] = prevXY[inputOffset];
				prevXY[outputOffset + 1] = prevXY[inputOffset + 1];
			}
			outputPointIndex++;
		}
	}
	pointCount = outputPointIndex;
}

function prunePoints() {
	// pointStatus is only valid (indices line up) before filtering occurs, so must come first, and be separate
	filterPoints((pointIndex)=> pointStatus[pointIndex] == 1);

	// TODO: de-duplicate points that have collapsed together
	// filterPoints((pointIndex)=> {
	// 	var pointOffset = pointIndex * 2;
	// 	// so I need to interate over the other points here, will that be a problem?
	// });
}

function animate() {
	requestAnimationFrame(animate);
	draw(!SLOWMO);
}

function draw(update=true) {
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
				facemeshEstimateFaces(cameraVideo).then((predictions)=> {
					facemeshPrediction = predictions[0]; // may be undefined
					facemeshEstimating = false;
					facemeshPredictionIsFresh = true;
					useClmtrackr = false;
					showClmtrackr = false;
				}, ()=> {
					facemeshEstimating = false;
				});
			}
		}

		var xyswap = prevXY;
		prevXY = curXY;
		curXY = xyswap;
		var pyrswap = prevPyramid;
		prevPyramid = curPyramid;
		curPyramid = pyrswap;

		// these are options worth breaking out and exploring
		var winSize = 20;
		var maxIterations = 30;
		var epsilon = 0.01;
		var minEigen = 0.001;

		jsfeat.imgproc.grayscale(imageData.data, imageData.width, imageData.height, curPyramid.data[0]);
		curPyramid.build(curPyramid.data[0], true);
		jsfeat.optical_flow_lk.track(
			prevPyramid, curPyramid,
			prevXY, curXY,
			pointCount,
			winSize, maxIterations,
			pointStatus,
			epsilon, minEigen);
		prunePoints();
	}
	
	if (facemeshPrediction) {
		ctx.fillStyle = "red";

		const bad = facemeshPrediction.faceInViewConfidence < faceInViewConfidenceThreshold;
		ctx.fillStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
		if (!bad || pointCount < 4 || facemeshPrediction.faceInViewConfidence > pointsBasedOnFaceInViewConfidence + 0.05) {
			if (bad) {
				ctx.fillStyle = 'rgba(255,0,255)';
			}
			if (update && useFacemesh && facemeshPredictionIsFresh) {
				pointsBasedOnFaceInViewConfidence = facemeshPrediction.faceInViewConfidence;

				const {annotations} = facemeshPrediction;
				// nostrils
				maybeAddPoint(annotations.noseLeftCorner[0][0], annotations.noseLeftCorner[0][1]);
				maybeAddPoint(annotations.noseRightCorner[0][0], annotations.noseRightCorner[0][1]);
				// inner eye corners
				maybeAddPoint(annotations.leftEyeLower0[8][0], annotations.leftEyeLower0[8][1]);
				maybeAddPoint(annotations.rightEyeLower0[8][0], annotations.rightEyeLower0[8][1]);

				// TODO: separate threshold for culling?

				// cull points to those within useful facial region
				filterPoints((pointIndex)=> {
					var pointOffset = pointIndex * 2;
					// distance from tip of nose (stretched so make an ellipse taller than wide)
					var distance = Math.hypot((annotations.noseTip[0][0] - curXY[pointOffset]) * 1.4, annotations.noseTip[0][1] - curXY[pointOffset + 1]);
					var headSize = Math.hypot(annotations.leftCheek[0][0] - annotations.rightCheek[0][0], annotations.leftCheek[0][1] - annotations.rightCheek[0][1]);
					if (distance > headSize) {
						return false;
					}
					return true;
				});
			}
			facemeshPrediction.scaledMesh.forEach(([x, y, z])=> {
				// x += prevMovementX;
				// y += prevMovementY;
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
		if (!bad || pointCount < 4 || faceScore > pointsBasedOnFaceScore + 0.05) {
			if (bad) {
				ctx.strokeStyle = 'rgba(255,0,255)';
			}
			if (update && useClmtrackr) {
				pointsBasedOnFaceScore = faceScore;

				// nostrils
				maybeAddPoint(face[42][0], face[42][1]);
				maybeAddPoint(face[43][0], face[43][1]);
				// inner eye corners
				maybeAddPoint(face[25][0], face[25][1]);
				maybeAddPoint(face[30][0], face[30][1]);

				// TODO: separate threshold for culling?

				// cull points to those within useful facial region
				filterPoints((pointIndex)=> {
					var pointOffset = pointIndex * 2;
					// distance from tip of nose (stretched so make an ellipse taller than wide)
					var distance = Math.hypot((face[62][0] - curXY[pointOffset]) * 1.4, face[62][1] - curXY[pointOffset + 1]);
					// distance based on outer eye corners
					var headSize = Math.hypot(face[23][0] - face[28][0], face[23][1] - face[28][1]);
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
	for (var i = 0; i < pointCount; i++) {
		var pointOffset = i * 2;
		var distMoved = Math.hypot(prevXY[pointOffset] - curXY[pointOffset], prevXY[pointOffset + 1] - curXY[pointOffset + 1]);
		if (distMoved >= 1) {
			ctx.fillStyle = "lime";
		} else {
			ctx.fillStyle = "gray";
		}
		movementX += curXY[pointOffset] - prevXY[pointOffset];
		movementY += curXY[pointOffset + 1] - prevXY[pointOffset + 1];
		numMovements += 1;
		circle(curXY[pointOffset], curXY[pointOffset + 1], 3);
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

		// ctx.fillStyle = "red";
		// circle(mouseX, mouseY, 10);
		mouseEl.style.left = `${mouseX}px`;
		mouseEl.style.top = `${mouseY}px`;

		// prevMovementX = movementX;
		// prevMovementY = movementY;
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

	facemeshPredictionIsFresh = false;
}

function circle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	// ctx.stroke();
}

animate();
if (SLOWMO) {
	setInterval(draw, 200);
}
