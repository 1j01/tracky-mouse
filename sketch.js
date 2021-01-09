// https://inspirit.github.io/jsfeat/sample_oflow_lk.html

var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');

document.body.appendChild(canvas);

var cameraVideo = document.createElement('video');
// required to work in iOS 11 & up:
cameraVideo.setAttribute('playsinline', '');

var curpyr, prevpyr, pointCount, pointStatus, prevxy, curxy;
var w = 640;
var h = 480;
var maxPoints = 1000;
var mymousex = 0;
var mymousey = 0;
var sensitivityX = 10;
var sensitivityY = 8;

var ctrack = new clm.tracker();
ctrack.init();
var trackingStarted = false;

function setup() {
	if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
		throw new DOMException('getUserMedia not supported in this browser');
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

	curpyr = new jsfeat.pyramid_t(3);
	prevpyr = new jsfeat.pyramid_t(3);
	curpyr.allocate(w, h, jsfeat.U8C1_t);
	prevpyr.allocate(w, h, jsfeat.U8C1_t);

	pointCount = 0;
	pointStatus = new Uint8Array(maxPoints);
	prevxy = new Float32Array(maxPoints * 2);
	curxy = new Float32Array(maxPoints * 2);
}

setup();

// function keyPressed(key) {
// 	for (var i = 0; i < 100; i++) {
// 		addPoint(random(width), random(height));
// 	}
// }

canvas.addEventListener('click', (event)=> {
	addPoint(event.offsetX, event.offsetY);
});

function addPoint(x, y) {
	if (pointCount < maxPoints) {
		var pointIndex = pointCount * 2;
		curxy[pointIndex] = x;
		curxy[pointIndex + 1] = y;
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
				curxy[outputIndex] = curxy[inputIndex];
				curxy[outputIndex + 1] = curxy[inputIndex + 1];
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
		var xyswap = prevxy;
		prevxy = curxy;
		curxy = xyswap;
		var pyrswap = prevpyr;
		prevpyr = curpyr;
		curpyr = pyrswap;

		// these are options worth breaking out and exploring
		var winSize = 20;
		var maxIterations = 30;
		var epsilon = 0.01;
		var minEigen = 0.001;

		jsfeat.imgproc.grayscale(imageData.data, imageData.width, imageData.height, curpyr.data[0]);
		curpyr.build(curpyr.data[0], true);
		jsfeat.optical_flow_lk.track(
			prevpyr, curpyr,
			prevxy, curxy,
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
			ctrack.draw(canvas);
		}

		var movementX = 0;
		var movementY = 0;
		var numMovements = 0;
		for (var i = 0; i < pointCount; i++) {
			var pointOffset = i * 2;
			var distMoved = Math.hypot(prevxy[pointOffset] - curxy[pointOffset], prevxy[pointOffset + 1] - curxy[pointOffset + 1]);
			// TODO: ignore points that were just initialized
			if (distMoved >= 1) {
				ctx.fillStyle = "lime";
			} else {
				ctx.fillStyle = "gray";
			}
			movementX += curxy[pointOffset] - prevxy[pointOffset];
			movementY += curxy[pointOffset + 1] - prevxy[pointOffset + 1];
			numMovements += 1;
			circle(curxy[pointOffset], curxy[pointOffset + 1], 4);
		}
		if (numMovements > 0) {
			movementX /= numMovements;
			movementY /= numMovements;
		}

		mymousex -= movementX * sensitivityX;
		mymousey += movementY * sensitivityY;

		mymousex = Math.min(Math.max(0, mymousex), w);
		mymousey = Math.min(Math.max(0, mymousey), h);

		ctx.fillStyle = "red";
		circle(mymousex, mymousey, 10);
	}
}

function circle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	// ctx.stroke();
}

animate();
