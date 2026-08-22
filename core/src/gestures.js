import { signedDistancePointLine } from "./helpers.js";

function getAspectMetrics(upperContour, lowerContour) {
	// The lower eye keypoints have the corners
	const corners = [lowerContour[0], lowerContour[lowerContour.length - 1]];
	// Excluding the corners isn't really important since their measures will be 0.
	const otherPoints = upperContour.concat(lowerContour).filter(point => !corners.includes(point));
	let highest = 0;
	let lowest = 0;
	for (const point of otherPoints) {
		const distance = signedDistancePointLine(point, corners[0], corners[1]);
		if (distance < lowest) {
			lowest = distance;
		}
		if (distance > highest) {
			highest = distance;
		}
	}

	const width = Math.hypot(
		corners[0][0] - corners[1][0],
		corners[0][1] - corners[1][1]
	);
	const height = highest - lowest;
	return {
		corners,
		upperContour,
		lowerContour,
		highest,
		lowest,
		heightRatio: height / width,
	};
}

export function detectBlinks(annotations, blinkInfo) {
	// Note: currently head tilt matters a lot, but ideally it should not.
	// - When moving closer to the camera, theoretically the eye size to head size ratio increases.
	//   (if you can hold your eye still, you can test by moving nearer to / further from the camera (or moving the camera))
	// - When tilting your head left or right, the contour of one closed eyelid becomes more curved* (as it wraps around your head),
	//   while the other stays near center of the visual region of your head and thus stays relatively straight (experiencing less projection distortion).
	// - When tilting your head down, the contour of a closed eyelid becomes more curved, which can lead to false negatives.
	// - When tilting your head up, the contour of an open eyelid becomes more straight, which can lead to false positives.
	// - *This is a geometric explanation, but in practice, facemesh loses the ability to detect
	//   whether the eye is closed when the head is tilted beyond a point.
	//   Enable `showDebugEyeZoom` to see the shapes we're dealing with here.
	// - Facemesh uses an "attention mesh model", enabled with `refineLandmarks: true`,
	//   which adjusts points near the eyes and lips to be more accurate (and is 100% necessary for this blink detection to work).
	//   This is what we might ideally target to improve blink detection.
	// TODO: try variations, e.g.
	// - As I noted here: https://github.com/1j01/tracky-mouse/issues/1#issuecomment-2053931136
	//   sometimes a fully closed eye isn't detected as fully closed, and an eye can be open and detected at a
	//   similar squinty level; however, if one eye is detected as fully closed, and the other eye is at that squinty level,
	//   I think it can be assumed that the squinty eye is open, and otherwise, if neither eye is detected as fully closed,
	//   then a squinty level can be assumed to be closed. So it might make sense to bias the blink detection, taking into account both eyes.
	//   (When you blink one eye, you naturally squint with the other a bit, but not necessarily as much as the model reports.
	//   I suspect this physical phenomenon may have biased the model since eye blinking and opposite eye squinting are correlated.)
	// - Maybe measure several points instead of just the middle or extreme points
	// - Can we use a 3D version of the facemesh instead of 2D, to help with ignoring head tilt??
	//   That might be the most important improvement...
	//   We can get z by making getPoint return the z value as well, but this is still camera-relative.
	//   We could transform it using some reference points, but do we have to?
	//   https://chuoling.github.io/mediapipe/solutions/face_mesh.html
	//   This mentions a "face pose transformation matrix" which sounds useful...
	// - Adjust threshold based on head tilt
	//   - When head is tilted up, make it consider eye open with a thinner eye shape.
	// Out-of-the-box ideas:
	// - Use a separate model for eye state detection, using images of the eye region as input.
	//   - I've thought about using "Teachable Machine" for this, it's meant to make training models easy, idk if it's still relevant
	// - Use multiple cameras. Having a camera on either side would allow seeing the eye from a clear angle in at least one camera,
	//   with significant left/right head tilt.
	//   - It might also help to improve tracking accuracy, by averaging two face meshes, if we can get them into the same coordinate space.
	//   - We might want to ditch the point tracking and just use the facemesh points at that point, although it should still
	//     be possible to use point tracking as long as it's tracked separately and averaged, and the cameras are placed symmetrically.
	// - Use mirrors. Instead of multiple cameras, imagine two mirrors on either side of the user, angled to reflect the user's head into the camera.
	//   - Fiducial markers on the frames of the mirrors could be used to help with the coordinate space transformation.
	//   - Music stands could be used to hold the mirrors, or they could be hung from the ceiling.
	//     - One might worry about breaking mirrors, but sandbags on stand bases or padding on the mirror frames could help to be safe.
	//   - Lighting integrated into the mirror frames would be a bonus; this is a feature of some vanity mirrors.
	//   - Fewer video streams to process, but more video processing steps, so I'm not sure how it would shake out performance-wise.
	//   - If you're hoping for it to improve tracking, remember that the tracking can be janky when the face is cut off,
	//     and the mirrors would introduce more edges.
	//     - The larger the mirror the better, but the more expensive and unwieldy and thus unlikely to be used.
	//     - If you were to try to avoid using results from faces that are cut off,
	//       you would likely be trying to use the same janky tracking results to determine whether the face is cut off.
	//       It *might* work, but it also might be a bit of a chicken-and-egg problem.

	const eyes = {
		leftEye: getAspectMetrics(annotations.leftEyeUpper0, annotations.leftEyeLower0),
		rightEye: getAspectMetrics(annotations.rightEyeUpper0, annotations.rightEyeLower0)
	};

	const thresholdHigh = 0.2;
	const thresholdLow = 0.16;
	for (const key of ["leftEye", "rightEye"]) {
		eyes[key].open = eyes[key].heightRatio > (blinkInfo?.[key].open ? thresholdLow : thresholdHigh);
	}

	// An attempt at biasing the blink detection based on the other eye's state
	// (I'm not sure if this is the same as the idea I had noted above)
	// const threshold = 0.16;
	// const bias = 0.3;
	// eyes.leftEye.open = eyes.leftEye.heightRatio - threshold - ((eyes.rightEye.heightRatio - threshold) * bias) > 0;
	// eyes.rightEye.open = eyes.rightEye.heightRatio - threshold - ((eyes.leftEye.heightRatio - threshold) * bias) > 0;

	// Involuntary blink rejection
	const blinkRejectDuration = 100; // milliseconds
	const currentTime = performance.now();
	for (const key of ["leftEye", "rightEye"]) {
		if (eyes[key].open === blinkInfo?.[key].open) {
			eyes[key].timeSinceChange = blinkInfo?.[key].timeSinceChange ?? currentTime;
		} else {
			eyes[key].timeSinceChange = currentTime;
		}
	}
	const timeSinceChange = currentTime - Math.max(eyes.leftEye.timeSinceChange, eyes.rightEye.timeSinceChange);
	eyes.leftEye.active = timeSinceChange > blinkRejectDuration && eyes.rightEye.open && !eyes.leftEye.open;
	eyes.rightEye.active = timeSinceChange > blinkRejectDuration && eyes.leftEye.open && !eyes.rightEye.open;

	eyes.leftEye.thresholdMet = !eyes.leftEye.open;
	eyes.rightEye.thresholdMet = !eyes.rightEye.open;

	return eyes;
}

export function detectMouthOpen(annotations, mouthInfo) {
	const prevThresholdMet = mouthInfo?.thresholdMet;
	const mouth = getAspectMetrics(annotations.lipsUpperInner, annotations.lipsLowerInner);
	const thresholdHigh = 0.25;
	const thresholdLow = 0.15;
	mouth.thresholdMet = mouth.heightRatio > (prevThresholdMet ? thresholdLow : thresholdHigh);
	mouth.active = mouth.thresholdMet; // TODO: maybe default to false, have this only set externally in gesture handling code
	return mouth;
}
