import { maybeAddPoint } from "./point-tracker.js";

/**
 * Optimize the set of tracked points based on regions of the face.
 */
export function curateTrackedPointsWithFacemesh({ pointTracker, annotations, showDebugRegionFilter, ctx, canvas, s }) {

	// nostrils
	maybeAddPoint(pointTracker, annotations.noseLeftCorner[0][0], annotations.noseLeftCorner[0][1]);
	maybeAddPoint(pointTracker, annotations.noseRightCorner[0][0], annotations.noseRightCorner[0][1]);
	// midway between eyes
	maybeAddPoint(pointTracker, annotations.midwayBetweenEyes[0][0], annotations.midwayBetweenEyes[0][1]);
	// inner eye corners
	// maybeAddPoint(pointTracker, annotations.leftEyeLower0[8][0], annotations.leftEyeLower0[8][1]);
	// maybeAddPoint(pointTracker, annotations.rightEyeLower0[8][0], annotations.rightEyeLower0[8][1]);


	// TODO: separate confidence threshold for removing vs adding points?


	// cull points to those within useful facial region
	function regionFilter([x, y]) {

		// distance from tip of nose (stretched so make an ellipse taller than wide)
		let distance = Math.hypot(
			(annotations.noseTip[0][0] - x) * 1.4,
			annotations.noseTip[0][1] - y
		);
		let headSize = Math.hypot(
			annotations.leftCheek[0][0] - annotations.rightCheek[0][0],
			annotations.leftCheek[0][1] - annotations.rightCheek[0][1]
		);
		if (distance > headSize) {
			return false;
		}
		// Avoid mouth affecting pointer position.
		distance = annotations.lipsLowerInner.map((lipPoint) =>
			Math.min(
				Math.hypot(lipPoint[0] - x, lipPoint[1] - y),
				Math.hypot(lipPoint[0] - x, lipPoint[1] + headSize * 0.1 - y), // a bit below too
				Math.hypot(lipPoint[0] - x, lipPoint[1] + headSize * 0.2 - y), // a bit below too
				Math.hypot(lipPoint[0] - x, lipPoint[1] + headSize * 0.3 - y), // a bit below too
				Math.hypot(lipPoint[0] - x, lipPoint[1] + headSize * 0.4 - y), // a bit below too (yeah I'm being a little lazy here)
			)
		).reduce((a, b) => Math.min(a, b), Infinity);
		if (distance < headSize * 0.1) {
			return false;
		}
		// Avoid blinking eyes affecting pointer position.
		// distance to outer corners of eyes
		distance = Math.min(
			Math.hypot(
				annotations.leftEyeLower0[0][0] - x,
				annotations.leftEyeLower0[0][1] - y
			),
			Math.hypot(
				annotations.rightEyeLower0[0][0] - x,
				annotations.rightEyeLower0[0][1] - y
			),
		);
		if (distance < headSize * 0.42) {
			return false;
		}
		return true;
	}
	pointTracker.filterPoints((pointIndex) => {
		let pointOffset = pointIndex * 2;
		const point = [pointTracker.curXY[pointOffset], pointTracker.curXY[pointOffset + 1]];
		return regionFilter(point);
	});

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
}

/**
 * Optimize the set of tracked points based on regions of the face.
 */
export function curateTrackedPointsWithClmtrackr({ pointTracker, face }) {

	// nostrils
	maybeAddPoint(pointTracker, face[42][0], face[42][1]);
	maybeAddPoint(pointTracker, face[43][0], face[43][1]);
	// inner eye corners
	// maybeAddPoint(pointTracker, face[25][0], face[25][1]);
	// maybeAddPoint(pointTracker, face[30][0], face[30][1]);

	// TODO: separate confidence threshold for removing vs adding points?

	// cull points to those within useful facial region
	pointTracker.filterPoints((pointIndex) => {
		let pointOffset = pointIndex * 2;
		// distance from tip of nose (stretched so make an ellipse taller than wide)
		let distance = Math.hypot(
			(face[62][0] - pointTracker.curXY[pointOffset]) * 1.4,
			face[62][1] - pointTracker.curXY[pointOffset + 1]
		);
		// distance based on outer eye corners
		let headSize = Math.hypot(
			face[23][0] - face[28][0],
			face[23][1] - face[28][1]
		);
		if (distance > headSize) {
			return false;
		}
		return true;
	});
}
