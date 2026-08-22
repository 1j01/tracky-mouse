ctx.resetTransform(); // in case there is an error, don't flip constantly back and forth due to mirroring
ctx.clearRect(0, 0, canvas.width, canvas.height); // in case there's no footage
ctx.save();
ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
currentCameraImageData = imageData;

if (s.mirror) {
	ctx.translate(canvas.width, 0);
	ctx.scale(-1, 1);
	ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
}
// Debug visualization for region filter (a sort of heatmap of where points will be culled)
if (showDebugRegionFilter) {
	ctx.save();
	if (s.mirror) {
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
	}
	ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
	const vizStep = 4;
	for (let x = 0; x < canvas.width; x += vizStep) {
		for (let y = 0; y < canvas.height; y += vizStep) {
			if (!regionFilter([x, y])) {
				ctx.fillRect(x - 5, y - 5, vizStep, vizStep);
			}
		}
	}
	ctx.restore();
}
if (facemeshPrediction) {
	ctx.fillStyle = "red";

	const bad = facemeshPrediction.faceInViewConfidence < faceInViewConfidenceThreshold;
	ctx.fillStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
	if (!bad || pointTracker.pointCount < 3 || facemeshPrediction.faceInViewConfidence > pointsBasedOnFaceInViewConfidence + 0.05) {
		if (bad) {
			ctx.fillStyle = 'rgba(255,0,255)';
		}
		for (const { x, y } of facemeshPrediction.keypoints) {
			ctx.fillRect(x, y, 1, 1);
		}
		if (top && bottom && left && right && nose) {

			const cx = nose.x;
			const cy = nose.y;
			const arrowLen = 100;

			ctx.save();
			ctx.translate(cx, cy);

			ctx.fillStyle = "cyan";
			ctx.font = "bold 20px monospace";
			ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
			ctx.lineWidth = 3;
			ctx.lineJoin = "round";

			const textX = 60;
			const textLineHeight = 25;
			const textYStart = -10;


			const headTiltRows = [
				{ label: t("debug.headTilt.pitch", { defaultValue: "Pitch:" }), value: `${(headTilt.pitch * 180 / Math.PI).toFixed(1)}°` },
				{ label: t("debug.headTilt.yaw", { defaultValue: "Yaw:" }), value: `${(headTilt.yaw * 180 / Math.PI).toFixed(1)}°` },
				{ label: t("debug.headTilt.roll", { defaultValue: "Roll:" }), value: `${(headTilt.roll * 180 / Math.PI).toFixed(1)}°` },
			];
			const labelWidths = headTiltRows.map(row => ctx.measureText(row.label).width);
			const maxLabelWidth = Math.max(...labelWidths);
			const valueColumnTemplate = "-180.0°";
			const maxValueWidth = ctx.measureText(valueColumnTemplate).width;
			const labelToValueGap = 10;
			const boxPadding = 10;
			const boxWidth = boxPadding * 2 + maxLabelWidth + labelToValueGap + maxValueWidth;
			const boxHeight = textLineHeight * headTiltRows.length;
			const valueColumnRightOffset = boxPadding + maxLabelWidth + labelToValueGap + maxValueWidth;

			// Calculate screen coordinates for the text box
			let screenX = s.mirror ? canvas.width - cx : cx;
			let screenY = cy;

			// Nominal position relative to head center
			let textScreenX = screenX + textX;
			let textScreenY = screenY + textYStart;

			// Clamp to canvas bounds
			textScreenX = Math.max(boxPadding, Math.min(canvas.width - boxWidth - boxPadding, textScreenX));
			textScreenY = Math.max(textLineHeight, Math.min(canvas.height - boxHeight + textLineHeight, textScreenY));

			ctx.save();
			if (s.mirror) {
				ctx.scale(-1, 1);
			}

			const screenNoseX = s.mirror ? canvas.width - cx : cx;
			const screenNoseY = cy;

			const dx = textScreenX - screenNoseX;
			const dy = textScreenY - screenNoseY;

			for (let i = 0; i < headTiltRows.length; i++) {
				const row = headTiltRows[i];
				const baselineY = dy + textLineHeight * (i + 1);
				const labelX = dx + boxPadding;
				const valueTextWidth = ctx.measureText(row.value).width;
				const valueRightX = dx + valueColumnRightOffset;
				const valueX = valueRightX - valueTextWidth;
				ctx.strokeText(row.label, labelX, baselineY);
				ctx.fillText(row.label, labelX, baselineY);
				ctx.strokeText(row.value, valueX, baselineY);
				ctx.fillText(row.value, valueX, baselineY);
			}

			ctx.restore();

			// Visualize head direction
			const vUp = { x: top.x - bottom.x, y: top.y - bottom.y, z: top.z - bottom.z }; // Up vector (Chin to Top)
			const vRight = { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }; // Right vector (Right to Left)

			// Cross Product: Right x Up
			const vFwd = {
				x: vRight.y * vUp.z - vRight.z * vUp.y,
				y: vRight.z * vUp.x - vRight.x * vUp.z,
				z: vRight.x * vUp.y - vRight.y * vUp.x
			};

			const mag = Math.hypot(vFwd.x, vFwd.y, vFwd.z);
			if (mag > 0.001) {
				ctx.strokeStyle = "cyan";
				ctx.beginPath();
				ctx.moveTo(0, 0);
				const s = arrowLen / mag;
				ctx.lineTo(vFwd.x * s, vFwd.y * s);
				ctx.stroke();

				ctx.fillStyle = "cyan";
				ctx.beginPath();
				ctx.arc(vFwd.x * s, vFwd.y * s, 5, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.restore();
		}
	}
};

const drawAspectMetrics = ({ corners, lowest, highest, active, thresholdMet }) => {
	const [a, b] = corners;
	ctx.strokeStyle = active ? "red" : thresholdMet ? "yellow" : "cyan";
	ctx.beginPath();
	ctx.moveTo(a[0], a[1]);
	ctx.lineTo(b[0], b[1]);
	ctx.stroke();
	// draw extents as a rectangle
	ctx.save();
	ctx.translate(a[0], a[1]);
	ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
	ctx.beginPath();
	ctx.rect(0, lowest, Math.hypot(b[0] - a[0], b[1] - a[1]), highest - lowest);
	ctx.stroke();
	ctx.restore();
};

if (blinkInfo?.used) {
	ctx.save();
	ctx.lineWidth = 2;
	drawAspectMetrics(blinkInfo.leftEye);
	drawAspectMetrics(blinkInfo.rightEye);

	if (showDebugEyeZoom) {
		debugEyeCanvas.style.display = "";
		const boxWidth = 150;
		const boxHeight = 100;

		if (debugEyeCanvas.width !== boxWidth * 2 || debugEyeCanvas.height !== boxHeight) {
			debugEyeCanvas.width = boxWidth * 2;
			debugEyeCanvas.height = boxHeight;
		}

		debugEyeCtx.fillStyle = "black";
		debugEyeCtx.fillRect(0, 0, debugEyeCanvas.width, debugEyeCanvas.height);
		debugEyeCtx.save();
		debugEyeCtx.translate(s.mirror ? debugEyeCanvas.width : 0, 0);
		debugEyeCtx.scale(s.mirror ? -1 : 1, 1);

		const zoom = 5;
		const drawDebugEye = (eye, offsetX) => {
			const points = [...eye.upperContour, ...eye.lowerContour];
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const [x, y] of points) {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
			const cx = (minX + maxX) / 2;
			const cy = (minY + maxY) / 2;

			const sw = boxWidth / zoom;
			const sh = boxHeight / zoom;
			const sx = cx - sw / 2;
			const sy = cy - sh / 2;

			debugEyeCtx.drawImage(cameraVideo, sx, sy, sw, sh, offsetX, 0, boxWidth, boxHeight);

			debugEyeCtx.save();
			debugEyeCtx.beginPath();
			debugEyeCtx.rect(offsetX, 0, boxWidth, boxHeight);
			debugEyeCtx.clip();

			debugEyeCtx.translate(offsetX, 0);
			debugEyeCtx.scale(zoom, zoom);
			debugEyeCtx.translate(-sx, -sy);

			debugEyeCtx.lineWidth = 1 / zoom * 2;
			debugEyeCtx.strokeStyle = "lime";

			for (const contour of [eye.upperContour, eye.lowerContour]) {
				debugEyeCtx.beginPath();
				for (let i = 0; i < contour.length; i++) {
					const [x, y] = contour[i];
					if (i === 0) debugEyeCtx.moveTo(x, y);
					else debugEyeCtx.lineTo(x, y);
				}
				debugEyeCtx.stroke();
			}
			debugEyeCtx.restore();
		};

		drawDebugEye(blinkInfo.rightEye, 0);
		drawDebugEye(blinkInfo.leftEye, boxWidth);

		debugEyeCtx.restore();
	} else {
		debugEyeCanvas.style.display = "none";
	}
	ctx.restore();
}
if (mouthInfo?.used) {
	ctx.save();
	ctx.lineWidth = 2;
	drawAspectMetrics(mouthInfo);
	ctx.restore();
}


if (face) {
	const bad = faceScore < faceScoreThreshold;
	ctx.strokeStyle = bad ? 'rgb(255,255,0)' : 'rgb(130,255,50)';
	if (!bad || pointTracker.pointCount < 2 || faceScore > pointsBasedOnFaceScore + 0.05) {
		if (bad) {
			ctx.strokeStyle = 'rgba(255,0,255)';
		}
		ctx.fillStyle = "lime";
		pointTracker.draw(ctx);
		debugPointsCtx.fillStyle = "green";
		pointTracker.draw(debugPointsCtx);

		if (debugAcceleration) {
			const graphWidth = 200;
			const graphHeight = 150;
			const graphMaxInput = 0.2;
			const graphMaxOutput = 0.4;
			const highlightInputRange = 0.01;
			ctx.save();
			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, graphWidth, graphHeight);
			const highlightInput = movementX * s.headTrackingSensitivityX;
			for (let x = 0; x < graphWidth; x++) {
				const input = x / graphWidth * graphMaxInput;
				const output = accelerate(input, input);
				const y = output / graphMaxOutput * graphHeight;
				// ctx.fillStyle = Math.abs(y - deltaX) < 1 ? "yellow" : "lime";
				const highlight = Math.abs(Math.abs(input) - Math.abs(highlightInput)) < highlightInputRange;
				if (highlight) {
					ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
					ctx.fillRect(x, 0, 1, graphHeight);
				}
				ctx.fillStyle = highlight ? "yellow" : "lime";
				ctx.fillRect(x, graphHeight - y, 1, y);
			}
			ctx.restore();
		}

		ctx.restore();

		if (showDebugText) {
			ctx.save();
			ctx.fillStyle = "#fff";
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 3;
			ctx.font = "20px sans-serif";
			ctx.beginPath();
			const text3 = `${t("debug.faceConvergenceScore", { defaultValue: "Face convergence score:" })} ${((useFacemesh && facemeshPrediction) ? t("common.notApplicable", { defaultValue: "N/A" }) : faceConvergence.toFixed(4))}`;
			const text1 = `${t("debug.faceTrackingScore", { defaultValue: "Face tracking score:" })} ${((useFacemesh && facemeshPrediction) ? facemeshPrediction.faceInViewConfidence : faceScore).toFixed(4)}`;
			const text2 = `${t("debug.pointsBasedOnScore", { defaultValue: "Points based on score:" })} ${((useFacemesh && facemeshPrediction) ? pointsBasedOnFaceInViewConfidence : pointsBasedOnFaceScore).toFixed(4)}`;
			ctx.strokeText(text1, 50, 50);
			ctx.fillText(text1, 50, 50);
			ctx.strokeText(text2, 50, 70);
			ctx.fillText(text2, 50, 70);
			ctx.strokeText(text3, 50, 170);
			ctx.fillText(text3, 50, 170);
			ctx.fillStyle = "lime";
			ctx.fillRect(0, 150, faceConvergence, 5);
			ctx.fillRect(0, 0, faceScore * canvas.width, 5);
			ctx.restore();
		}
		if (showClmTracking) {
			clmTracker.draw(canvas, undefined, undefined, true);
		}
