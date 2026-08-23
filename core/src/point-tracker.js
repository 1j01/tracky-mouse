/* global jsfeat */

/** Optical flow point tracking system */
export class PointTracker {
	constructor({
		cameraVideo,
		maxPoints,
		pruningGridSize,
		ctx,
	}) {
		this.cameraVideo = cameraVideo;
		this.maxPoints = maxPoints;
		this.pruningGridSize = pruningGridSize;
		this.ctx = ctx;

		this.curPyramid = new jsfeat.pyramid_t(3);
		this.prevPyramid = new jsfeat.pyramid_t(3);
		this.curPyramid.allocate(cameraVideo.videoWidth, cameraVideo.videoHeight, jsfeat.U8C1_t);
		this.prevPyramid.allocate(cameraVideo.videoWidth, cameraVideo.videoHeight, jsfeat.U8C1_t);

		this.pointCount = 0;
		this.pointStatus = new Uint8Array(maxPoints);
		this.prevXY = new Float32Array(maxPoints * 2);
		this.curXY = new Float32Array(maxPoints * 2);
	}
	addPoint(x, y) {
		if (this.pointCount < this.maxPoints) {
			let pointIndex = this.pointCount * 2;
			this.curXY[pointIndex] = x;
			this.curXY[pointIndex + 1] = y;
			this.prevXY[pointIndex] = x;
			this.prevXY[pointIndex + 1] = y;
			this.pointCount++;
		}
	}
	filterPoints(condition) {
		let outputPointIndex = 0;
		for (let inputPointIndex = 0; inputPointIndex < this.pointCount; inputPointIndex++) {
			if (condition(inputPointIndex)) {
				if (outputPointIndex < inputPointIndex) {
					const inputOffset = inputPointIndex * 2;
					const outputOffset = outputPointIndex * 2;
					this.curXY[outputOffset] = this.curXY[inputOffset];
					this.curXY[outputOffset + 1] = this.curXY[inputOffset + 1];
					this.prevXY[outputOffset] = this.prevXY[inputOffset];
					this.prevXY[outputOffset + 1] = this.prevXY[inputOffset + 1];
				}
				outputPointIndex++;
			} else {
				// this.debugPointsCtx.fillStyle = "red";
				const inputOffset = inputPointIndex * 2;
				// circle(this.debugPointsCtx, this.curXY[inputOffset], this.curXY[inputOffset + 1], 5);
				// this.debugPointsCtx.fillText(condition.toString(), 5 + this.curXY[inputOffset], this.curXY[inputOffset + 1]);
				// console.log(this.curXY[inputOffset], this.curXY[inputOffset + 1]);
				this.ctx.strokeStyle = this.ctx.fillStyle;
				this.ctx.beginPath();
				this.ctx.moveTo(this.prevXY[inputOffset], this.prevXY[inputOffset + 1]);
				this.ctx.lineTo(this.curXY[inputOffset], this.curXY[inputOffset + 1]);
				this.ctx.stroke();
			}
		}
		this.pointCount = outputPointIndex;
	}
	prunePoints() {
		// pointStatus is only valid (indices line up) before filtering occurs, so must come first (could be combined though)
		this.filterPoints((pointIndex) => this.pointStatus[pointIndex] == 1);

		// De-duplicate points that are too close together
		// - Points that have collapsed together are completely useless.
		// - Points that are too close together are not necessarily helpful,
		//   and may adversely affect the tracking due to uneven weighting across your face.
		// - Reducing the number of points improves FPS.
		const grid = {};
		for (let pointIndex = 0; pointIndex < this.pointCount; pointIndex++) {
			const pointOffset = pointIndex * 2;
			grid[`${~~(this.curXY[pointOffset] / this.pruningGridSize)},${~~(this.curXY[pointOffset + 1] / this.pruningGridSize)}`] = pointIndex;
		}
		const indexesToKeep = Object.values(grid);
		this.filterPoints((pointIndex) => indexesToKeep.includes(pointIndex));
	}
	update(imageData) {
		[this.prevXY, this.curXY] = [this.curXY, this.prevXY];
		[this.prevPyramid, this.curPyramid] = [this.curPyramid, this.prevPyramid];

		// these are options worth breaking out and exploring
		let winSize = 20;
		let maxIterations = 30;
		let epsilon = 0.01;
		let minEigen = 0.001;

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
	draw(ctx) {
		for (let i = 0; i < this.pointCount; i++) {
			let pointOffset = i * 2;
			// let distMoved = Math.hypot(
			// 	this.prevXY[pointOffset] - this.curXY[pointOffset],
			// 	this.prevXY[pointOffset + 1] - this.curXY[pointOffset + 1]
			// );
			// if (distMoved >= 1) {
			// 	ctx.fillStyle = "lime";
			// } else {
			// 	ctx.fillStyle = "gray";
			// }
			circle(ctx, this.curXY[pointOffset], this.curXY[pointOffset + 1], 3);
			ctx.strokeStyle = ctx.fillStyle;
			ctx.beginPath();
			ctx.moveTo(this.prevXY[pointOffset], this.prevXY[pointOffset + 1]);
			ctx.lineTo(this.curXY[pointOffset], this.curXY[pointOffset + 1]);
			ctx.stroke();
		}
	}
	getMovement() {
		let movementX = 0;
		let movementY = 0;
		let numMovements = 0;
		for (let i = 0; i < this.pointCount; i++) {
			let pointOffset = i * 2;
			movementX += this.curXY[pointOffset] - this.prevXY[pointOffset];
			movementY += this.curXY[pointOffset + 1] - this.prevXY[pointOffset + 1];
			numMovements += 1;
		}
		if (numMovements > 0) {
			movementX /= numMovements;
			movementY /= numMovements;
		}
		return [movementX, movementY];
	}
}

export function maybeAddPoint(pointTracker, x, y) {
	const minDistanceToAddPoint = pointTracker.pruningGridSize * 1.5;

	// In order to prefer points that already exist, since they're already tracking,
	// in order to keep a smooth overall tracking calculation,
	// don't add points if they're close to an existing point.
	// Otherwise, it would not just be redundant, but often remove the older points, in the pruning.
	for (let pointIndex = 0; pointIndex < pointTracker.pointCount; pointIndex++) {
		let pointOffset = pointIndex * 2;
		// let distance = Math.hypot(
		// 	x - pointTracker.curXY[pointOffset],
		// 	y - pointTracker.curXY[pointOffset + 1]
		// );
		// if (distance < 8) {
		// 	return;
		// }
		// It might be good to base this on the size of the face...
		// Also, since we're pruning points based on a grid,
		// there's not much point in using Euclidean distance here,
		// we can just look at x and y distances.
		if (
			Math.abs(x - pointTracker.curXY[pointOffset]) <= minDistanceToAddPoint ||
			Math.abs(y - pointTracker.curXY[pointOffset + 1]) <= minDistanceToAddPoint
		) {
			return;
		}
	}
	pointTracker.addPoint(x, y);
}


function circle(ctx, x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}
