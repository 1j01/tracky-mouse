
var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');

document.body.appendChild(canvas);

var cameraVideo = document.createElement('video');
// required to work in iOS 11 & up:
cameraVideo.setAttribute('playsinline', '');

var curPyramid, prevPyramid, pointCount, pointStatus, prevXY, curXY;
var w = 640;
var h = 480;
var maxPoints = 1000;
var mouseX = 0;
var mouseY = 0;
var sensitivityX = 10;
var sensitivityY = 8;
var faceThreshold = 0.5;

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
	ctrack.start(cameraVideo);
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
	addPoint(event.offsetX, event.offsetY);
});

function addPoint(x, y) {
	if (pointCount < maxPoints) {
		var pointIndex = pointCount * 2;
		curXY[pointIndex] = x;
		curXY[pointIndex + 1] = y;
		pointCount++;
	}
}

function maybeAddPoint(x, y) {
	for (var pointIndex = 0; pointIndex < pointCount; pointIndex++) {
		var pointOffset = pointIndex * 2;
		var distance = Math.hypot(x - curXY[pointOffset], y - curXY[pointOffset + 1]);
		if (distance < 20) {
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
			}
			outputPointIndex++;
		}
	}
	pointCount = outputPointIndex;
}

function prunePoints() {
	// pointStatus is only valid (indices line up) before filtering occurs, so must come first, and be separate
	filterPoints((pointIndex)=> pointStatus[pointIndex] == 1);

	// TODO: actively cull points that have collapsed together
	// filterPoints((pointIndex)=> {
	// 	var pointOffset = pointIndex * 2;
	// 	// so I need to interate over the other points here, will that be a problem?
	// });
}

function animate() {
	requestAnimationFrame(animate);
	draw();
}

function draw() {
	ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	if (true) {
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

		ctx.save();
		ctx.fillStyle = "#fff";
		ctx.strokeStyle = "#000";
		ctx.lineWidth = 3;
		ctx.font = "20px sans-serif";
		ctx.beginPath();
		ctx.strokeText("Face tracking score: " + ctrack.getScore().toFixed(4), 50, 50);
		ctx.fillText("Face tracking score: " + ctrack.getScore().toFixed(4), 50, 50);
		ctx.stroke();
		ctx.fill();
		ctx.restore();
		
		var face = ctrack.getCurrentPosition();
		if (face) {
			const bad = ctrack.getScore() < faceThreshold;
			ctx.strokeStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
			ctrack.draw(canvas, undefined, undefined, true);
			if (!bad) {
				// TODO: use YAPE? https://inspirit.github.io/jsfeat/sample_yape.html
				// - fallback to random points or points based on face detection geometry if less than N points

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
					// TODO: base on head size
					if (distance > headSize) {
						return false;
					}
					return true;
				});
			}
		}

		var movementX = 0;
		var movementY = 0;
		var numMovements = 0;
		for (var i = 0; i < pointCount; i++) {
			var pointOffset = i * 2;
			var distMoved = Math.hypot(prevXY[pointOffset] - curXY[pointOffset], prevXY[pointOffset + 1] - curXY[pointOffset + 1]);
			// TODO: ignore points that were just initialized
			if (distMoved >= 1) {
				ctx.fillStyle = "lime";
			} else {
				ctx.fillStyle = "gray";
			}
			movementX += curXY[pointOffset] - prevXY[pointOffset];
			movementY += curXY[pointOffset + 1] - prevXY[pointOffset + 1];
			numMovements += 1;
			circle(curXY[pointOffset], curXY[pointOffset + 1], 4);
		}
		if (numMovements > 0) {
			movementX /= numMovements;
			movementY /= numMovements;
		}

		mouseX -= movementX * sensitivityX;
		mouseY += movementY * sensitivityY;

		mouseX = Math.min(Math.max(0, mouseX), w);
		mouseY = Math.min(Math.max(0, mouseY), h);

		ctx.fillStyle = "red";
		circle(mouseX, mouseY, 10);
	}
}

function circle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	// ctx.stroke();
}

animate();