
export const isSelectorValid = ((dummyElement) =>
	(selector) => {
		try { dummyElement.querySelector(selector); } catch { return false; }
		return true;
	})(document.createDocumentFragment());


/** Basically Promise.withResolvers (but I'm not sure browser support is good enough) */
export function createDeferred() {
	let resolve, reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Returns the distance between a point and a line defined by two points, with the sign indicating which side of the line the point is on */
export function signedDistancePointLine(point, a, b) {
	const [px, py] = point;
	const [x1, y1] = a;
	const [x2, y2] = b;

	const dx = x2 - x1;
	const dy = y2 - y1;

	// Perpendicular (normal) vector
	const nx = -dy;
	const ny = dx;

	return ((px - x1) * nx + (py - y1) * ny) / Math.hypot(nx, ny);
}

export function averagePoints(points) {
	const average = { x: 0, y: 0 };
	for (const point of points) {
		average.x += point.x;
		average.y += point.y;
	}
	average.x /= points.length;
	average.y /= points.length;
	return average;
};
