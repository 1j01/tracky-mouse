
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

function prunePoints() {
	var outputPoint = 0;
	for (var inputPoint = 0; inputPoint < pointCount; inputPoint++) {
		if (pointStatus[inputPoint] == 1) {
			if (outputPoint < inputPoint) {
				var inputIndex = inputPoint * 2;
				var outputIndex = outputPoint * 2;
				curXY[outputIndex] = curXY[inputIndex];
				curXY[outputIndex + 1] = curXY[inputIndex + 1];
			}
			outputPoint++;
		}
	}
	pointCount = outputPoint;
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
		if (ctrack.getCurrentPosition()) {
			ctx.strokeStyle = ctrack.getScore() < faceThreshold ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
			ctrack.draw(canvas, undefined, undefined, true);
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
