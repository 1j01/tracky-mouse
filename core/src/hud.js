
import { TrackyMouse } from "./tracky-mouse.js";

export function initScreenOverlay() {

	const template = `
	<div class="tracky-mouse-hide-near-cursor">
		<div id="tracky-mouse-screen-overlay-work-area">
			<div class="tracky-mouse-absolute-center">
				<div class="tracky-mouse-screen-overlay-status-indicator tracky-mouse-manual-takeback-indicator">
					<img src="${TrackyMouse.dependenciesRoot}/images/manual-takeback.svg" alt="hand reaching for mouse" width="128" height="128">
				</div>
				<div class="tracky-mouse-screen-overlay-status-indicator tracky-mouse-head-not-found-indicator">
					<img src="${TrackyMouse.dependenciesRoot}/images/head-not-found.svg" alt="head not found" width="128" height="128">
				</div>
			</div>
			<div id="tracky-mouse-screen-overlay-message"></div>
		</div>
	</div>
	`;
	const fragment = document.createRange().createContextualFragment(template);
	document.body.appendChild(fragment);

	const message = document.getElementById("tracky-mouse-screen-overlay-message");
	const workAreaContainer = document.getElementById("tracky-mouse-screen-overlay-work-area");
	message.dir = "auto";

	const hideNearCursorEls = document.querySelectorAll(".tracky-mouse-hide-near-cursor");

	const inputFeedbackCanvas = document.createElement("canvas");
	inputFeedbackCanvas.className = "tracky-mouse-input-feedback-canvas";
	inputFeedbackCanvas.style.position = "fixed";
	inputFeedbackCanvas.style.zIndex = "899990"; // just below .tracky-mouse-pointer
	inputFeedbackCanvas.style.top = "0";
	inputFeedbackCanvas.style.left = "0";
	inputFeedbackCanvas.style.pointerEvents = "none";
	inputFeedbackCanvas.width = 60;
	inputFeedbackCanvas.height = 60;
	document.body.appendChild(inputFeedbackCanvas);
	const inputFeedbackCtx = inputFeedbackCanvas.getContext("2d");

	function drawInputFeedback({ inputFeedback, isEnabled }) {
		const { blinkInfo, mouthInfo, virtualJoystickInfo } = inputFeedback;
		inputFeedbackCtx.clearRect(0, 0, inputFeedbackCanvas.width, inputFeedbackCanvas.height);
		if (!isEnabled) {
			return;
		}
		if (virtualJoystickInfo?.used) {
			drawVirtualJoystick(virtualJoystickInfo);
		}
		// draw meters for blink and mouth openness
		// TODO: draw meter backings to disambiguate showing zero vs being occluded by taskbar
		// (Ideally it should stay on top of the taskbar and context menus all the time
		// 	but that's another issue: https://github.com/1j01/tracky-mouse/issues/14)
		const drawMeter = (x, yCenter, width, height, { active, thresholdMet }) => {
			inputFeedbackCtx.fillStyle = active ? "red" : thresholdMet ? "yellow" : "cyan";
			inputFeedbackCtx.fillRect(x, yCenter - height / 2, width, height);
		};
		if (blinkInfo?.used) {
			for (const eye of [blinkInfo.leftEye, blinkInfo.rightEye]) {
				drawMeter(eye === blinkInfo.leftEye ? 5 : 20, 5, 10, Math.max(2, 20 * eye.heightRatio), eye);
			}
		}
		if (mouthInfo?.used) {
			drawMeter(0, 20, 23, Math.max(2, 40 * mouthInfo.heightRatio), mouthInfo);
		}
	}

	function drawVirtualJoystick({ x, y, numDirections }) {
		const ctx = inputFeedbackCtx;
		const r = inputFeedbackCanvas.width / 2 - 2;
		ctx.save();
		ctx.translate(inputFeedbackCanvas.width / 2, inputFeedbackCanvas.height / 2);
		ctx.fillStyle = "rgba(124, 91, 91, 0.5)";
		ctx.strokeStyle = "rgb(80, 40, 40)";
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, 2 * Math.PI);
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.stroke();

		if (numDirections > 0 && numDirections < 360) {
			// Draw sectors, highlighting the active one.
			// TODO: show deadzone and don't highlight when in deadzone
			// Also, use a single source of truth for the active direction
			// that works with angle hysteresis* and whatever else.
			// (*I haven't determined that the hysteresis actually helps.
			// It might need to be smarter and use magnitude, maybe something like
			// if you imagine the slotted pathways that a stick shift has,
			// locking into a lane and requiring a return to center.)
			const activeDirection = Math.round((Math.atan2(y, -x) + 2 * Math.PI) / (2 * Math.PI) * numDirections) % numDirections;
			for (let i = 0; i < numDirections; i++) {
				const angleStart = ((i - 1 / 2) / numDirections) * 2 * Math.PI;
				const angleEnd = ((i + 1 / 2) / numDirections) * 2 * Math.PI;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.arc(0, 0, r, angleStart, angleEnd);
				ctx.closePath();
				ctx.fillStyle = i === activeDirection ? "rgba(255, 0, 0, 0.77)" : "rgba(124, 91, 91, 0.5)";
				ctx.fill();
				ctx.strokeStyle = i === activeDirection ? "rgb(255, 160, 160)" : "rgb(80, 40, 40)";
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		ctx.fillStyle = "rgba(255, 80, 80, 0.77)";
		ctx.strokeStyle = "rgb(255, 160, 160)";
		ctx.beginPath();
		// TODO: minimize number of places x axis is negated throughout the codebase
		ctx.arc(-x * (inputFeedbackCanvas.width / 2), y * (inputFeedbackCanvas.height / 2), inputFeedbackCanvas.width / 5, 0, 2 * Math.PI);
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.restore();
	}

	function updateMousePos(x, y) {
		// inputFeedbackCanvas.style.transform = `translate(${x - inputFeedbackCanvas.width / 2}px, ${y - inputFeedbackCanvas.height / 2}px)`;
		// inputFeedbackCanvas.style.transform = `translate(${x}px, ${y}px)`;
		inputFeedbackCanvas.style.transform = `translate(${Math.min(x, window.innerWidth - inputFeedbackCanvas.width)}px, ${Math.min(y, window.innerHeight - inputFeedbackCanvas.height)}px)`;

	}

	function update(data) {
		const {
			messageText,
			isEnabled,
			isManualTakeback,
			inputFeedback,
			workAreaContainerBounds,
			bottomOffset,
			systemMousePosition,
		} = data;

		if (workAreaContainerBounds) {
			workAreaContainer.style.left = `${workAreaContainerBounds.x}px`;
			workAreaContainer.style.top = `${workAreaContainerBounds.y}px`;
			workAreaContainer.style.width = `${workAreaContainerBounds.width}px`;
			workAreaContainer.style.height = `${workAreaContainerBounds.height}px`;
			message.style.bottom = "0px";
		} else {
			// bottomOffset was a never-released part of an unstable API.
			// workAreaContainerBounds could be made required, just like bottomOffset was.
			workAreaContainer.style.left = "0px";
			workAreaContainer.style.top = "0px";
			workAreaContainer.style.width = "100%";
			workAreaContainer.style.height = `calc(100% - ${bottomOffset ?? 0}px)`;
		}

		// Other diagnostics in the future would be stuff like:
		// - head too far away (smaller than a certain size) https://github.com/1j01/tracky-mouse/issues/49
		// - bad lighting conditions
		// see: https://github.com/1j01/tracky-mouse/issues/26

		document.body.classList.toggle("tracky-mouse-manual-takeback", isManualTakeback ?? false);
		document.body.classList.toggle("tracky-mouse-head-not-found", inputFeedback.headNotFound ?? false);

		message.innerText = messageText;

		if (!isEnabled && !isManualTakeback) {
			// Fade out the message after a little while so it doesn't get in the way.
			// TODO: make sure animation isn't interrupted by inputFeedback updates.
			message.style.animation = "tracky-mouse-fade-out 2s ease-in-out forwards 10s";
		} else {
			message.style.animation = "";
			message.style.opacity = "1";
		}

		drawInputFeedback(data);

		if (systemMousePosition) {
			const { x, y } = systemMousePosition;
			// TODO: optimize CSS parsing by using CSS variables?
			const maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent 0, transparent 50px, rgba(0, 0, 0, 0.85) 140px, rgba(0, 0, 0, 1) 200px, rgba(0, 0, 0, 1) 100%)`;
			for (const el of hideNearCursorEls) {
				el.style.webkitMaskImage = maskImage;
				el.style.maskImage = maskImage;
			}
		}
	}

	return {
		update,
		updateMousePos,
	};
};
