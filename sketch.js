// https://inspirit.github.io/jsfeat/sample_oflow_lk.html

var cnv;
var canvasElement;
var capture;
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

	var cameraVideo = document.createElement('video');
	// required to work in iOS 11 & up:
	cameraVideo.setAttribute('playsinline', '');

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

	capture = new p5.MediaElement(cameraVideo, p5);
	capture.loadedmetadata = false;
	cameraVideo.addEventListener('loadedmetadata', function () {
		cameraVideo.play();
		if (cameraVideo.width) {
			capture.width = cameraVideo.width;
			capture.height = cameraVideo.height;
		} else {
			capture.width = capture.elt.width = cameraVideo.videoWidth;
			capture.height = capture.elt.height = cameraVideo.videoHeight;
		}
		capture.loadedmetadata = true;

		console.log('capture ready.');
	});
	cameraVideo.addEventListener('canplay', () => {
		ctrack.start(cameraVideo);
		trackingStarted = true;
	});

	cnv = createCanvas(w, h);
	capture.size(w, h);
	capture.hide();

	curpyr = new jsfeat.pyramid_t(3);
	prevpyr = new jsfeat.pyramid_t(3);
	curpyr.allocate(w, h, jsfeat.U8C1_t);
	prevpyr.allocate(w, h, jsfeat.U8C1_t);

	pointCount = 0;
	pointStatus = new Uint8Array(maxPoints);
	prevxy = new Float32Array(maxPoints * 2);
	curxy = new Float32Array(maxPoints * 2);

	canvasElement = document.querySelector('canvas');
}

// function keyPressed(key) {
// 	for (var i = 0; i < 100; i++) {
// 		addPoint(random(width), random(height));
// 	}
// }

function mousePressed() {
	addPoint(mouseX, mouseY);
}

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

function draw() {
	image(capture, 0, 0, w, h);
	capture.loadPixels();
	if (capture.pixels.length > 0) { // don't forget this!
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

		jsfeat.imgproc.grayscale(capture.pixels, w, h, curpyr.data[0]);
		curpyr.build(curpyr.data[0], true);
		jsfeat.optical_flow_lk.track(
			prevpyr, curpyr,
			prevxy, curxy,
			pointCount,
			winSize, maxIterations,
			pointStatus,
			epsilon, minEigen);
		prunePoints();

		fill("#fff");
		stroke("#000");
		strokeWeight(3);
		text("Face tracking score: " + ctrack.getScore().toFixed(4), 50, 50);
		noStroke();
		if (ctrack.getCurrentPosition()) {
			ctrack.draw(canvasElement);
		}

		var movementX = 0;
		var movementY = 0;
		var numMovements = 0;
		for (var i = 0; i < pointCount; i++) {
			var pointOffset = i * 2;
			var distMoved = Math.hypot(prevxy[pointOffset] - curxy[pointOffset], prevxy[pointOffset + 1] - curxy[pointOffset + 1]);
			// TODO: ignore points that were just initialized
			if (distMoved >= 1) {
				fill("lime");
			} else {
				fill("gray");
			}
			movementX += curxy[pointOffset] - prevxy[pointOffset];
			movementY += curxy[pointOffset + 1] - prevxy[pointOffset + 1];
			numMovements += 1;
			ellipse(curxy[pointOffset], curxy[pointOffset + 1], 8, 8);
		}
		if (numMovements > 0) {
			movementX /= numMovements;
			movementY /= numMovements;
		}

		mymousex -= movementX * sensitivityX;
		mymousey += movementY * sensitivityY;

		mymousex = Math.min(Math.max(0, mymousex), w);
		mymousey = Math.min(Math.max(0, mymousey), h);

		fill("red");
		ellipse(mymousex, mymousey, 20, 20);
	}
}
