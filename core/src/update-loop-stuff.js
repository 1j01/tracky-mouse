
const timestamp = performance.now();
const deltaTime = Math.min(timestamp - lastTimestamp, 100);
lastTimestamp = timestamp;

sleepSweep?.setEnabled(s.closeEyesToToggle);
sleepSweep?.update(sleepGestureProgress);

if (!pointTracker) {
	return;
}

if (update) {
	if (clmTrackingStarted) {
		if (useClmTracking || showClmTracking) {
			try {
				clmTracker.track(cameraVideo);
			} catch (error) {
				console.warn("Error in clmTracker.track()", error);
				if (clmTracker.getCurrentParameters().includes(NaN)) {
					console.warn("NaNs crept in.");
				}
			}
			face = clmTracker.getCurrentPosition();
			faceScore = clmTracker.getScore();
			faceConvergence = Math.pow(clmTracker.getConvergence(), 0.5);
		}
		if (facemeshLoaded && !facemeshEstimating) {
			facemeshEstimating = true;
			// movementXSinceFacemeshUpdate = 0;
			// movementYSinceFacemeshUpdate = 0;
			cameraFramesSinceFacemeshUpdate = [];
			// If I switch virtual console desktop sessions in Ubuntu with Ctrl+Alt+F1 (and back with Ctrl+Alt+F2),
			// WebGL context is lost, which breaks facemesh (and clmTracker if useWebGL is not false)
			// Error: Size(8192) must match the product of shape 0, 0, 0
			//     at inferFromImplicitShape (tf.js:14142)
			//     at Object.reshape$3 [as kernelFunc] (tf.js:110368)
			//     at kernelFunc (tf.js:17241)
			//     at tf.js:17334
			//     at Engine.scopedRun (tf.js:17094)
			//     at Engine.runKernelFunc (tf.js:17328)
			//     at Engine.runKernel (tf.js:17171)
			//     at reshape_ (tf.js:25875)
			//     at reshape__op (tf.js:18348)
			//     at executeOp (tf.js:85396)
			// WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost

			// Note that the first estimation from facemesh often takes a while*,
			// and we don't want to continuously terminate the worker** as it's working on those first results.
			// And also, for the first estimate it hasn't actually disabled clmtrackr yet, so it's fine if it's a long timeout.
			// *Or it did, before updating the facemesh pipeline.
			// **Not using a worker for facemesh anymore...
			clearTimeout(fallbackTimeoutID);
			fallbackTimeoutID = setTimeout(() => {
				if (!useClmTracking) {
					reset();
					clmTracker.init();
					clmTracker.reset();
					clmTracker.initFaceDetector(cameraVideo);
					clmTrackingStarted = true;
					console.warn("Falling back to clmtrackr");
				}
				// If you've switched desktop sessions, it will presumably fail to get a new webgl context until you've switched back
				// Is this setInterval useful, vs just starting the worker?**
				// It probably has a faster cycle, with the code as it is now, but maybe not inherently.
				// TODO: do the extra getContext() calls add to a GPU process crash limit
				// that makes it only able to recover a couple times (outside the electron app)?
				// For electron, I set chromium flag --disable-gpu-process-crash-limit so it can recover unlimited times.
				// TODO: there's still the case of WebGL backend failing to initialize NOT due to the process crash limit,
				// where it'd be good to have it try again (maybe with exponential falloff?)
				// (I think I can move my fallbackTimeout code into/around `initFacemeshWorker` and `facemeshEstimateFaces`)

				// Note: clearTimeout/clearInterval work interchangeably
				fallbackTimeoutID = setInterval(() => {
					try {
						// TODO: attempting webgl context creation beforehand doesn't make sense without a worker
						// If it's running in the same thread, we can just try creating the detector.

						// Once we can create a webgl2 canvas...
						document.createElement("canvas").getContext("webgl2");
						clearInterval(fallbackTimeoutID);
						// It's worth trying to re-initialize [a web worker** for facemesh]...
						setTimeout(() => {
							console.warn("Re-initializing facemesh");
							initFacemesh();
							facemeshRejectNext = 1; // or more?
						}, 1000);
					} catch (error) {
						if (error.name !== "InvalidStateError") {
							throw error;
						} else {
							console.warn("Trying to recover; can't create webgl2 canvas yet...");
						}
					}
				}, 500);
			}, facemeshFirstEstimation ? 20000 : 2000);
			facemeshEstimateFaces().then((predictions) => {
				facemeshEstimating = false;
				facemeshFirstEstimation = false;

				facemeshRejectNext -= 1;
				if (facemeshRejectNext > 0) {
					return;
				}

				facemeshPrediction = predictions[0]; // undefined if no faces found

				useClmTracking = false;
				showClmTracking = false;
				clearTimeout(fallbackTimeoutID);

				if (!facemeshPrediction) {
					blinkInfo = null;
					mouthInfo = null;
					return;
				}
				facemeshPrediction.faceInViewConfidence = 0.9999; // TODO: any equivalent in new API?

				const getPoint = (index) =>
					facemeshPrediction.keypoints[index] ?
						[facemeshPrediction.keypoints[index].x, facemeshPrediction.keypoints[index].y, facemeshPrediction.keypoints[index].z] :
						undefined;

				const annotations = Object.fromEntries(Object.entries(MESH_ANNOTATIONS).map(([key, indices]) => {
					return [key, indices.map(getPoint)];
				}));

				// nostrils
				maybeAddPoint(pointTracker, annotations.noseLeftCorner[0][0], annotations.noseLeftCorner[0][1]);
				maybeAddPoint(pointTracker, annotations.noseRightCorner[0][0], annotations.noseRightCorner[0][1]);
				// midway between eyes
				maybeAddPoint(pointTracker, annotations.midwayBetweenEyes[0][0], annotations.midwayBetweenEyes[0][1]);
				// inner eye corners
				// maybeAddPoint(pointTracker, annotations.leftEyeLower0[8][0], annotations.leftEyeLower0[8][1]);
				// maybeAddPoint(pointTracker, annotations.rightEyeLower0[8][0], annotations.rightEyeLower0[8][1]);


				// console.log(pointTracker.pointCount, cameraFramesSinceFacemeshUpdate.length, pointTracker.curXY);

				pointsBasedOnFaceInViewConfidence = facemeshPrediction.faceInViewConfidence;

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


				const keypoints = facemeshPrediction.keypoints;
				if (keypoints) {
					const top = keypoints[10]; // Top of forehead
					const bottom = keypoints[2]; // Bottom of nose (formerly chin; this better avoids jaw movement effects)
					const left = keypoints[454]; // Subject left (Image right)
					const right = keypoints[234]; // Subject right (Image left)

					if (top && bottom && left && right) {

						headTilt.keypoints = { top, bottom, left, right };

						// Pitch (X-axis rotation)
						const pitchDy = bottom.y - top.y;
						const pitchDz = bottom.z - top.z;
						headTilt.pitch = Math.atan2(pitchDz, Math.abs(pitchDy));

						// Yaw (Y-axis rotation)
						const yawDx = left.x - right.x;
						const yawDz = left.z - right.z;
						headTilt.yaw = Math.atan2(yawDz, Math.abs(yawDx));

						// Roll (Z-axis rotation)
						const rollDy = left.y - right.y;
						const rollDx = left.x - right.x;
						headTilt.roll = Math.atan2(rollDy, rollDx);

						if (typeof OneEuroFilter !== "undefined") {
							const timestamp = performance.now() / 1000;
							if (!headTiltFilters.pitch) {
								const freq = 60;
								const mincutoff = 0.01;
								const beta = 5.0;
								const dcutoff = 0.7;
								for (const axis of ["pitch", "yaw", "roll"]) {
									headTiltFilters[axis] = new OneEuroFilter(freq, mincutoff, beta, dcutoff);
								}
							}
							for (const axis of ["pitch", "yaw", "roll"]) {
								headTilt[axis] = headTiltFilters[axis].filter(headTilt[axis], timestamp);
							}
						}
					}
				}

				const gestures = detectGestures({ blinkInfo, mouthInfo, sleepGestureProgress, sleepGestureEyesClosedDuration, mouseButtonUntilMouthCloses, annotations, s, deltaTime });
				({ blinkInfo, mouthInfo, sleepGestureProgress, sleepGestureEyesClosedDuration, mouseButtonUntilMouthCloses } = gestures);
				const { clickButton, sleepGestureTriggered } = gestures;
				if (sleepGestureTriggered) {
					paused = !paused;
					updatePaused();
					sleepSweep?.sleepModeWasToggled(paused);
				}

				const buttonNames = ["left", "middle", "right"];
				for (let buttonIndex = 0; buttonIndex < 3; buttonIndex++) {
					const buttonIsActive = clickButton === buttonIndex;
					if (buttonIsActive !== buttonStates[buttonNames[buttonIndex]]) {
						// Wait for confirmation of the button state change before playing SFX
						// but not before updating buttonStates, since we check that in this loop
						// to decide whether to call setMouseButtonState.
						// We don't want to send extraneous mouse button changes to the main process,
						// even if it does track button states itself. If nothing else it's wasted IPC.
						// That said, an argument could be made for updating lastMouseDownTime later
						// if the IPC is slow, to extend the time frame for making a simple click
						// rather than a drag.
						if (!setMouseButtonState) {
							console.warn("setMouseButtonState function not provided");
						} else {
							const maybeAPromise = setMouseButtonState(buttonIndex, buttonIsActive);
							const playSoundForButton = (changedButtonState) => {
								if (changedButtonState) {
									if (buttonIndex === 1) {
										playSound(buttonIsActive ? "middleClickPress" : "middleClickRelease", {
											volume: 4,
										});
									} else {
										playSound(buttonIsActive ? "clickPress" : "clickRelease", {
											playbackRate: buttonIndex === 0 ? 1 : buttonIndex === 2 ? 1.2 : 1.5,
										});
									}
								}
							};
							if (maybeAPromise instanceof Promise) {
								maybeAPromise.then(playSoundForButton);
							} else {
								playSoundForButton(maybeAPromise);
							}
						}
						buttonStates[buttonNames[buttonIndex]] = buttonIsActive;
						if (buttonIsActive) {
							lastMouseDownTime = performance.now();
						} else {
							// Limit "Delay Before Dragging" effect to the duration of a click.
							// TODO: consider how this affects releasing a mouse button if two are pressed (not currently possible)
							// TODO: rename variable, maybe change it to store a cool-down timer? but that would need more state management just for concept clarity
							lastMouseDownTime = -Infinity; // sorry, making this variable a misnomer
						}
					}
				}
			}, () => {
				facemeshEstimating = false;
				facemeshFirstEstimation = false;
			});
		}
	}
	pointTracker.update(imageData);
}

updateInputFeedback?.({
	headNotFound: !face && !facemeshPrediction,
	blinkInfo,
	mouthInfo,
});

	} else {
	if (update && useFacemesh) {
		pointsBasedOnFaceInViewConfidence -= 0.001;
	}
}

const keypoints = facemeshPrediction.keypoints;
if (showDebugHeadTilt && keypoints) {
	const { top, bottom, left, right } = headTilt.keypoints;
	const nose = keypoints[1];

	if (update && useClmTracking) {
		pointsBasedOnFaceScore = faceScore;

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
} else {
	if (update && useClmTracking) {
		pointsBasedOnFaceScore -= 0.001;
	}
}
};

if (update) {
	const screenWidth = window.electronAPI ? (virtualDisplayBounds?.width ?? screen.width) : innerWidth;
	const screenHeight = window.electronAPI ? (virtualDisplayBounds?.height ?? screen.height) : innerHeight;
	const screenOffsetX = window.electronAPI ? (virtualDisplayBounds?.x ?? 0) : 0;
	const screenOffsetY = window.electronAPI ? (virtualDisplayBounds?.y ?? 0) : 0;

	let [movementX, movementY] = pointTracker.getMovement();

	// Acceleration curves add a lot of stability,
	// letting you focus on a specific point without jitter, but still move quickly.

	// let accelerate = (delta, distance) => (delta / 10) * (distance ** 0.8);
	// let accelerate = (delta, distance) => (delta / 1) * (Math.abs(delta) ** 0.8);
	let accelerate = (delta, _distance) => (delta / 1) * (Math.abs(delta * 5) ** s.headTrackingAcceleration);

	let distance = Math.hypot(movementX, movementY);
	let deltaX = accelerate(movementX * s.headTrackingSensitivityX, distance);
	let deltaY = accelerate(movementY * s.headTrackingSensitivityY, distance);

	if (s.headTrackingTiltInfluence > 0) {
		const yawRange = [
			s.headTiltYawOffset - s.headTiltYawRange / 2,
			s.headTiltYawOffset + s.headTiltYawRange / 2
		];
		const pitchRange = [
			s.headTiltPitchOffset - s.headTiltPitchRange / 2,
			s.headTiltPitchOffset + s.headTiltPitchRange / 2
		];

		function normalize(value, min, max) {
			return (value - min) / (max - min);
		}

		const targetX = screenWidth * (1 - normalize(headTilt.yaw, yawRange[0], yawRange[1]));
		const targetY = screenHeight * normalize(headTilt.pitch, pitchRange[0], pitchRange[1]);

		const deltaXToMatchTilt = (mouseX - targetX) / screenWidth;
		const deltaYToMatchTilt = (targetY - mouseY) / screenHeight;
		// Slow down movement away from target, speed up movement towards target*
		// *conditionally. Applies to part of the slider range.
		// (Hey look, we can reuse the normalize function to choose where on the slider these effects kick in!)
		// - It might be worth trying other functions, e.g. exponential or sigmoid,
		//   or adding limits to how much it can change to see if it feels better.
		// - "Speeding up" necessarily incorporates any jitter from the head tilt,
		//   if we're just lerping towards the target.
		//   TODO: try incorporating the magnitude of the delta into the influence,
		//   such that zero delta will not move towards the head tilt target,
		//   ...unless we're at 100% of the slider? We still want to support
		//   pure head tilt mode. So I'm not sure what the ramp should be.
		// - Could make these different settings, which would make it less arbitrary (re: the 80% to 100% influence range),
		//   but not necessarily easier for the average user to tune; at some point you say
		//   "wow that's a lot of options, maybe I'll explore them later..." and back away slowly.
		//   This setting in particular is already probably hard to understand, so unless
		//   splitting it can make it a lot clearer, it's probably better not to add to the decision fatigue.
		const slowingInfluence = s.headTrackingTiltInfluence;
		const speedingInfluence = Math.max(0, Math.min(1, normalize(s.headTrackingTiltInfluence, 0.8, 1)));
		if (deltaX * deltaXToMatchTilt < 0) {
			deltaX *= 1 - slowingInfluence;
		} else {
			deltaX += (deltaXToMatchTilt - deltaX) * speedingInfluence;
		}
		if (deltaY * deltaYToMatchTilt < 0) {
			deltaY *= 1 - slowingInfluence;
		} else {
			deltaY += (deltaYToMatchTilt - deltaY) * speedingInfluence;
		}
	}

	// Mimicking eViacam's "Motion Threshold" implementation
	// https://github.com/cmauri/eviacam/blob/a4032ed9c59def5399a93e74f5ea84513d2f42b1/wxutil/mousecontrol.cpp#L310-L312
	// (a threshold on instantaneous Manhattan distance, or in other words, x and y speed, separately)
	// - It's applied after s.headTrackingAcceleration, following eViacam's lead,
	// which makes sense in order to have the setting's unit make sense as "pixels",
	// rather than "pixels before applying a function",
	// to say nothing of the qualitative differences there might be in reordering the operations.
	// - Note that it causes jumps which are increasingly noticeable as the setting is increased.
	// - TODO: consider a "leash" behavior, or a hybrid perhaps
	//   Note that a leash behavior might be less responsive to direction changes,
	//   and might not achieve the goal of stability unless you move back slightly,
	//   since if you've just pulled the leash left for instance, pulling it left
	//   will move it no matter how small, which might turn a click into a drag (if the "Delay Before Dragging" setting doesn't prevent it).
	//   You have to be in the center of the leash region for it to provide stability.
	//   I'm not sure what a hybrid would look like; it might make more sense as two
	//   separate settings, "motion threshold" and "leash distance".
	if (Math.abs(deltaX * screenWidth) < s.headTrackingMinDistance) {
		deltaX = 0;
	}
	if (Math.abs(deltaY * screenHeight) < s.headTrackingMinDistance) {
		deltaY = 0;
	}
	// Avoid dragging when trying to click by ignoring movement for a short time after a mouse down.
	// This applied previously also to release, to help with double clicks,
	// but this felt bad, and I find personally that I can still do double clicks without that help.
	const timeSinceMouseDown = performance.now() - lastMouseDownTime;
	if (timeSinceMouseDown < s.delayBeforeDragging) {
		deltaX = 0;
		deltaY = 0;
	}
	// This should never happen
	if (!isFinite(deltaX) || !isFinite(deltaY)) {
		return;
	}

	if (!paused) {
		if (s.headTrackingMovementMode == "direct") {
			mouseX -= deltaX * screenWidth;
			mouseY += deltaY * screenHeight;
		} else {
			// virtualJoystickX += deltaX;
			// virtualJoystickY += deltaY;
			// For now, only supporting absolute head tilt
			// TODO: support 2D point tracking and the "Tilt influence" slider
			// (complicating factors may include the screen size being baked into certain variables)
			virtualJoystickX = Math.max(-1, Math.min(1, headTilt.yaw / (s.headTiltYawRange / 2)));
			virtualJoystickY = Math.max(-1, Math.min(1, headTilt.pitch / (s.headTiltPitchRange / 2)));

			const joystickMaxSpeed = 30;
			const joystickDistanceToSpeedExponent = 2;
			const joystickTimeToSpeedExponent = 1;
			const joystickSpeedRampTime = 1500; // milliseconds
			const joystickMinSpeedThreshold = 0.3; // fraction of joystickSize; AKA deadzone
			const joystickMaxSpeedThreshold = 1; // fraction of joystickSize; AKA live-zone?
			const joystickSize = 1;
			const joystickAngleHysteresis = 0.3; // fraction of d-pad direction arc beyond the arc where it will switch to a different direction

			if (s.headTrackingMovementMode !== "direct") {

				const distance = Math.hypot(virtualJoystickX, virtualJoystickY);
				if (distance > joystickSize * joystickMinSpeedThreshold) {
					let angle = Math.atan2(virtualJoystickY, virtualJoystickX);

					const numDirections = parseInt(s.headTrackingMovementMode.match(/(\d+)/)?.[1] ?? 0, 10);
					if (numDirections) {
						// - Math.PI / 2 and + Math.PI / 2 are for 6 direction mode
						// Note that most isometric games use 2:1 slopes rather than true 120 degree angles
						angle = Math.round((angle - Math.PI / 2) / (Math.PI * 2) * numDirections) / numDirections * (Math.PI * 2) + Math.PI / 2;

						const angleDiff = Math.atan2(Math.sin(angle - virtualDPadAngle), Math.cos(angle - virtualDPadAngle));

						if (
							!isFinite(virtualDPadAngle) ||
							Math.abs(angleDiff) > Math.PI * 2 / numDirections / 2 * (1 + joystickAngleHysteresis)
						) {
							virtualDPadAngle = angle;
							virtualJoystickSpeedRampStartTime = performance.now();
						}
					} else {
						virtualDPadAngle = angle;
					}

					const timeAtThisAngle = performance.now() - virtualJoystickSpeedRampStartTime; // milliseconds
					const speedRampOverTime = numDirections ? Math.min(1, timeAtThisAngle / joystickSpeedRampTime) : 1;
					const speed = joystickMaxSpeed * Math.pow(
						Math.max(0, Math.min(1,
							((distance / joystickSize) - joystickMinSpeedThreshold) / (joystickMaxSpeedThreshold - joystickMinSpeedThreshold)
						)),
						joystickDistanceToSpeedExponent
					) * Math.pow(
						speedRampOverTime,
						joystickTimeToSpeedExponent
					);
					mouseX -= Math.cos(virtualDPadAngle) * speed;
					mouseY += Math.sin(virtualDPadAngle) * speed;
				}
				// normalize to within circle
				// if (distance > joystickSize) {
				// 	const scale = joystickSize / distance;
				// 	virtualJoystickX *= scale;
				// 	virtualJoystickY *= scale;
				// }
			} else {
				virtualJoystickSpeedRampStartTime = performance.now();
			}

		}

		mouseX = Math.min(Math.max(screenOffsetX, mouseX), screenOffsetX + screenWidth);
		mouseY = Math.min(Math.max(screenOffsetY, mouseY), screenOffsetY + screenHeight);

		if (mouseNeedsInitPos) {
			// TODO: option to get preexisting mouse position instead of set it to center of screen
			mouseX = screenOffsetX + screenWidth / 2;
			mouseY = screenOffsetY + screenHeight / 2;
			mouseNeedsInitPos = false;
		}
		if (window.electronAPI) {
			window.electronAPI.moveMouse(~~mouseX, ~~mouseY);
			pointerEl.style.display = "none";
		} else {
			pointerEl.style.display = "";
			pointerEl.style.left = `${Math.floor(mouseX)}px`;
			pointerEl.style.top = `${Math.floor(mouseY)}px`;
		}
		if (TrackyMouse.onPointerMove) {
			TrackyMouse.onPointerMove(mouseX, mouseY);
		}
	}
}
stats?.update();
	}