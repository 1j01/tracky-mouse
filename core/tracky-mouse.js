/* global jsfeat, Stats, clm, faceLandmarksDetection, OneEuroFilter */
const TrackyMouse = {
	dependenciesRoot: "./tracky-mouse",
};

TrackyMouse.loadDependencies = function ({ statsJs = false } = {}) {
	TrackyMouse.dependenciesRoot = TrackyMouse.dependenciesRoot.replace(/\/+$/, "");
	const loadScript = src => {
		return new Promise((resolve, reject) => {
			// This wouldn't wait for them to load
			// for (const script of document.scripts) {
			// 	if (script.src.includes(src)) {
			// 		resolve();
			// 		return;
			// 	}
			// }
			const script = document.createElement('script');
			script.type = 'text/javascript';
			script.onload = resolve;
			script.onerror = reject;
			script.src = src;
			document.head.append(script);
		});
	};
	const scriptFiles = [
		`${TrackyMouse.dependenciesRoot}/lib/no-eval.js`, // generated with eval-is-evil.html, this instruments clmtrackr.js so I don't need unsafe-eval in the CSP
		`${TrackyMouse.dependenciesRoot}/lib/clmtrackr.js`,
		`${TrackyMouse.dependenciesRoot}/lib/face_mesh/face_mesh.js`,
		`${TrackyMouse.dependenciesRoot}/lib/face-landmarks-detection.min.js`,
		`${TrackyMouse.dependenciesRoot}/lib/OneEuroFilter.js`,
	];
	if (statsJs) {
		scriptFiles.push(`${TrackyMouse.dependenciesRoot}/lib/stats.js`);
	}
	return Promise.all(scriptFiles.map(loadScript));
};

const isSelectorValid = ((dummyElement) =>
	(selector) => {
		try { dummyElement.querySelector(selector); } catch { return false; }
		return true;
	})(document.createDocumentFragment());


const dwellClickers = [];

const initDwellClicking = (config) => {
	/*
		Arguments:
		- `config.targets` (required): a CSS selector for the elements to click. Anything else will be ignored.
		- `config.shouldDrag(el)` (optional): a function that returns true if the element should be dragged rather than simply clicked.
		- `config.noCenter(el)` (optional): a function that returns true if the element should be clicked anywhere on the element, rather than always at the center.
		- `config.retarget` (optional): an array of `{ from, to, withinMargin }` objects, which define rules for dynamically changing what is hovered/clicked when the mouse is over a different element.
			- `from` (required): the element to retarget from. Can be a CSS selector, an element, or a function taking the element under the mouse and returning whether it should be retargeted.
			- `to` (required): the element to retarget to. Can be a CSS selector for an element which is an ancestor or descendant of the `from` element, or an element, or a function taking the element under the mouse and returning an element to retarget to, or null to ignore the element.
			- `withinMargin` (optional): a number of pixels within which to consider the mouse over the `to` element. Default to infinity.
		- `config.isEquivalentTarget(el1, el2)` (optional): a function that returns true if two elements should be considered part of the same control, i.e. if clicking either should do the same thing. Elements that are equal are always considered equivalent even if you return false. This option is used for preventing the system from detecting occluding elements as separate controls, and rejecting the click. (When an occlusion is detected, it flashes a red box.)
		- `config.dwellClickEvenIfPaused(el)` (optional): a function that returns true if the element should be clicked even while dwell clicking is otherwise paused. Use this for a dwell clicking toggle button, so it's possible to resume dwell clicking. With dwell clicking it's important to let users take a break, since otherwise you have to constantly move the cursor in order to not click on things!
		- `config.click({x, y, target})` (required): a function to trigger a click on the given target element.
		- `config.beforeDispatch()` (optional): a function to call before a pointer event is dispatched. For detecting un-trusted user gestures, outside of an event handler.
		- `config.afterDispatch()` (optional): a function to call after a pointer event is dispatched. For detecting un-trusted user gestures, outside of an event handler.
		- `config.beforePointerDownDispatch()` (optional): a function to call before a `pointerdown` event is dispatched. Likely to be merged with `config.beforeDispatch()` in the future.
		- `config.isHeld()` (optional): a function that returns true if the next dwell should be a release (triggering `pointerup`).
	*/
	if (typeof config !== "object") {
		throw new Error("configuration object required for initDwellClicking");
	}
	if (config.targets === undefined) {
		throw new Error("config.targets is required (must be a CSS selector)");
	}
	if (typeof config.targets !== "string") {
		throw new Error("config.targets must be a string (a CSS selector)");
	}
	if (!isSelectorValid(config.targets)) {
		throw new Error("config.targets is not a valid CSS selector");
	}
	if (config.click === undefined) {
		throw new Error("config.click is required");
	}
	if (typeof config.click !== "function") {
		throw new Error("config.click must be a function");
	}
	if (config.shouldDrag !== undefined && typeof config.shouldDrag !== "function") {
		throw new Error("config.shouldDrag must be a function");
	}
	if (config.noCenter !== undefined && typeof config.noCenter !== "function") {
		throw new Error("config.noCenter must be a function");
	}
	if (config.isEquivalentTarget !== undefined && typeof config.isEquivalentTarget !== "function") {
		throw new Error("config.isEquivalentTarget must be a function");
	}
	if (config.dwellClickEvenIfPaused !== undefined && typeof config.dwellClickEvenIfPaused !== "function") {
		throw new Error("config.dwellClickEvenIfPaused must be a function");
	}
	if (config.beforeDispatch !== undefined && typeof config.beforeDispatch !== "function") {
		throw new Error("config.beforeDispatch must be a function");
	}
	if (config.afterDispatch !== undefined && typeof config.afterDispatch !== "function") {
		throw new Error("config.afterDispatch must be a function");
	}
	if (config.beforePointerDownDispatch !== undefined && typeof config.beforePointerDownDispatch !== "function") {
		throw new Error("config.beforePointerDownDispatch must be a function");
	}
	if (config.isHeld !== undefined && typeof config.isHeld !== "function") {
		throw new Error("config.isHeld must be a function");
	}
	if (config.retarget !== undefined) {
		if (!Array.isArray(config.retarget)) {
			throw new Error("config.retarget must be an array of objects");
		}
		for (let i = 0; i < config.retarget.length; i++) {
			const rule = config.retarget[i];
			if (typeof rule !== "object") {
				throw new Error("config.retarget must be an array of objects");
			}
			if (rule.from === undefined) {
				throw new Error(`config.retarget[${i}].from is required`);
			}
			if (rule.to === undefined) {
				throw new Error(`config.retarget[${i}].to is required (although can be null to ignore the element)`);
			}
			if (rule.withinMargin !== undefined && typeof rule.withinMargin !== "number") {
				throw new Error(`config.retarget[${i}].withinMargin must be a number`);
			}
			if (typeof rule.from !== "string" && typeof rule.from !== "function" && !(rule.from instanceof Element)) {
				throw new Error(`config.retarget[${i}].from must be a CSS selector string, an Element, or a function`);
			}
			if (typeof rule.to !== "string" && typeof rule.to !== "function" && !(rule.to instanceof Element) && rule.to !== null) {
				throw new Error(`config.retarget[${i}].to must be a CSS selector string, an Element, a function, or null`);
			}
			if (typeof rule.from === "string" && !isSelectorValid(rule.from)) {
				throw new Error(`config.retarget[${i}].from is not a valid CSS selector`);
			}
			if (typeof rule.to === "string" && !isSelectorValid(rule.to)) {
				throw new Error(`config.retarget[${i}].to is not a valid CSS selector`);
			}
		}
	}

	// trackyMouseContainer.querySelector(".tracky-mouse-canvas").classList.add("inset-deep");

	const circleRadiusMax = 50; // dwell indicator size in pixels
	const hoverTimespan = 500; // how long between the dwell indicator appearing and triggering a click
	const averagingWindowTimespan = 500;
	const inactiveAtStartupTimespan = 1500; // (should be at least averagingWindowTimespan, but more importantly enough to make it not awkward when enabling dwell clicking)
	const inactiveAfterReleaseTimespan = 1000; // after click or drag release (from dwell or otherwise)
	const inactiveAfterHoveredTimespan = 1000; // after dwell click indicator appears; does not control the time to finish that dwell click, only to click on something else after this is canceled (but it doesn't control that directly)
	const inactiveAfterInvalidTimespan = 1000; // after a dwell click is canceled due to an element popping up in front, or existing in front at the center of the other element
	const inactiveAfterFocusedTimespan = 1000; // after page becomes focused after being unfocused
	let recentPoints = [];
	let inactiveUntilTime = performance.now();
	let paused = false;
	let hoverCandidate;
	let dwellDragging = null;

	const deactivateForAtLeast = (timespan) => {
		inactiveUntilTime = Math.max(inactiveUntilTime, performance.now() + timespan);
	};
	deactivateForAtLeast(inactiveAtStartupTimespan);

	const halo = document.createElement("div");
	halo.className = "tracky-mouse-hover-halo";
	halo.style.display = "none";
	document.body.appendChild(halo);
	const dwellIndicator = document.createElement("div");
	dwellIndicator.className = "tracky-mouse-dwell-indicator";
	dwellIndicator.style.width = `${circleRadiusMax}px`;
	dwellIndicator.style.height = `${circleRadiusMax}px`;
	dwellIndicator.style.display = "none";
	document.body.appendChild(dwellIndicator);

	const onPointerMove = (e) => {
		recentPoints.push({ x: e.clientX, y: e.clientY, time: performance.now() });
	};
	const onPointerUpOrCancel = (_e) => {
		deactivateForAtLeast(inactiveAfterReleaseTimespan);
		dwellDragging = null;
	};

	let pageFocused = document.visibilityState === "visible"; // guess/assumption
	let mouseInsidePage = true; // assumption
	const onFocus = () => {
		pageFocused = true;
		deactivateForAtLeast(inactiveAfterFocusedTimespan);
	};
	const onBlur = () => {
		pageFocused = false;
	};
	const onMouseLeavePage = () => {
		mouseInsidePage = false;
	};
	const onMouseEnterPage = () => {
		mouseInsidePage = true;
	};

	window.addEventListener("pointermove", onPointerMove);
	window.addEventListener("pointerup", onPointerUpOrCancel);
	window.addEventListener("pointercancel", onPointerUpOrCancel);
	window.addEventListener("focus", onFocus);
	window.addEventListener("blur", onBlur);
	document.addEventListener("mouseleave", onMouseLeavePage);
	document.addEventListener("mouseenter", onMouseEnterPage);

	const getHoverCandidate = (clientX, clientY) => {

		if (!pageFocused || !mouseInsidePage) return null;

		let target = document.elementFromPoint(clientX, clientY);
		if (!target) {
			return null;
		}

		let hoverCandidate = {
			x: clientX,
			y: clientY,
			time: performance.now(),
		};

		let retargeted = false;
		for (const { from, to, withinMargin = Infinity } of (config.retarget ?? [])) {
			if (
				from instanceof Element ? from === target :
					typeof from === "function" ? from(target) :
						target.matches(from)
			) {
				const toElement =
					(to instanceof Element || to === null) ? to :
						typeof to === "function" ? to(target) :
							(target.closest(to) || target.querySelector(to));
				if (toElement === null) {
					return null;
				} else if (toElement) {
					const toRect = toElement.getBoundingClientRect();
					if (
						hoverCandidate.x > toRect.left - withinMargin &&
						hoverCandidate.y > toRect.top - withinMargin &&
						hoverCandidate.x < toRect.right + withinMargin &&
						hoverCandidate.y < toRect.bottom + withinMargin
					) {
						target = toElement;
						hoverCandidate.x = Math.min(
							toRect.right - 1,
							Math.max(
								toRect.left,
								hoverCandidate.x,
							),
						);
						hoverCandidate.y = Math.min(
							toRect.bottom - 1,
							Math.max(
								toRect.top,
								hoverCandidate.y,
							),
						);
						retargeted = true;
					}
				}
			}
		}

		if (!retargeted) {
			target = target.closest(config.targets);

			if (!target) {
				return null;
			}
		}

		if (!config.noCenter?.(target)) {
			// Nudge hover previews to the center of buttons and things
			const rect = target.getBoundingClientRect();
			hoverCandidate.x = rect.left + rect.width / 2;
			hoverCandidate.y = rect.top + rect.height / 2;
		}
		hoverCandidate.target = target;
		return hoverCandidate;
	};

	const getEventOptions = ({ x, y }) => {
		return {
			view: window, // needed for offsetX/Y calculation
			clientX: x,
			clientY: y,
			pointerId: 1234567890,
			pointerType: "mouse",
			isPrimary: true,
			bubbles: true,
			cancelable: true,
		};
	};

	const averagePoints = (points) => {
		const average = { x: 0, y: 0 };
		for (const pointer of points) {
			average.x += pointer.x;
			average.y += pointer.y;
		}
		average.x /= points.length;
		average.y /= points.length;
		return average;
	};

	const update = () => {
		const time = performance.now();
		recentPoints = recentPoints.filter((pointRecord) => time < pointRecord.time + averagingWindowTimespan);
		if (recentPoints.length) {
			const latestPoint = recentPoints[recentPoints.length - 1];
			recentPoints.push({ x: latestPoint.x, y: latestPoint.y, time });
			const averagePoint = averagePoints(recentPoints);
			// debug
			// const canvasPoint = toCanvasCoords({clientX: averagePoint.x, clientY: averagePoint.y});
			// ctx.fillStyle = "red";
			// ctx.fillRect(canvasPoint.x, canvasPoint.y, 10, 10);
			const recentMovementAmount = Math.hypot(latestPoint.x - averagePoint.x, latestPoint.y - averagePoint.y);

			// Invalidate in case an element pops up in front of the element you're hovering over, e.g. a submenu
			// (that use case doesn't actually work in jspaint because the menu pops up before the hoverCandidate exists)
			// (TODO: disable hovering to open submenus in facial mouse mode in jspaint)
			// or an element occludes the center of an element you're hovering over, in which case it
			// could be confusing if it showed a dwell click indicator over a different element than it would click
			// (but TODO: just move the indicator off center in that case)
			if (hoverCandidate && !dwellDragging) {
				const apparentHoverCandidate = getHoverCandidate(hoverCandidate.x, hoverCandidate.y);
				const showOccluderIndicator = (occluder) => {
					const occluderIndicator = document.createElement("div");
					const occluderRect = occluder.getBoundingClientRect();
					const outlineWidth = 4;
					occluderIndicator.style.pointerEvents = "none";
					occluderIndicator.style.zIndex = 1000001;
					occluderIndicator.style.display = "block";
					occluderIndicator.style.position = "fixed";
					occluderIndicator.style.left = `${occluderRect.left + outlineWidth}px`;
					occluderIndicator.style.top = `${occluderRect.top + outlineWidth}px`;
					occluderIndicator.style.width = `${occluderRect.width - outlineWidth * 2}px`;
					occluderIndicator.style.height = `${occluderRect.height - outlineWidth * 2}px`;
					occluderIndicator.style.outline = `${outlineWidth}px dashed red`;
					occluderIndicator.style.boxShadow = `0 0 ${outlineWidth}px ${outlineWidth}px maroon`;
					document.body.appendChild(occluderIndicator);
					setTimeout(() => {
						occluderIndicator.remove();
					}, inactiveAfterInvalidTimespan * 0.5);
				};
				if (apparentHoverCandidate) {
					if (
						apparentHoverCandidate.target !== hoverCandidate.target &&
						// !retargeted &&
						!config.isEquivalentTarget?.(
							apparentHoverCandidate.target, hoverCandidate.target
						)
					) {
						hoverCandidate = null;
						deactivateForAtLeast(inactiveAfterInvalidTimespan);
						showOccluderIndicator(apparentHoverCandidate.target);
					}
				} else {
					let occluder = document.elementFromPoint(hoverCandidate.x, hoverCandidate.y);
					hoverCandidate = null;
					deactivateForAtLeast(inactiveAfterInvalidTimespan);
					showOccluderIndicator(occluder || document.body);
				}
			}

			let circlePosition = latestPoint;
			let circleOpacity = 0;
			let circleRadius = 0;
			if (hoverCandidate) {
				circlePosition = hoverCandidate;
				circleOpacity = 0.4;
				circleRadius =
					(hoverCandidate.time - time + hoverTimespan) / hoverTimespan
					* circleRadiusMax;
				if (time > hoverCandidate.time + hoverTimespan) {
					if (config.isHeld?.() || dwellDragging) {
						config.beforeDispatch?.();
						hoverCandidate.target.dispatchEvent(new PointerEvent("pointerup",
							Object.assign(getEventOptions(hoverCandidate), {
								button: 0,
								buttons: 0,
							})
						));
						config.afterDispatch?.();
					} else {
						config.beforePointerDownDispatch?.();
						config.beforeDispatch?.();
						hoverCandidate.target.dispatchEvent(new PointerEvent("pointerdown",
							Object.assign(getEventOptions(hoverCandidate), {
								button: 0,
								buttons: 1,
							})
						));
						config.afterDispatch?.();
						if (config.shouldDrag?.(hoverCandidate.target)) {
							dwellDragging = hoverCandidate.target;
						} else {
							config.beforeDispatch?.();
							hoverCandidate.target.dispatchEvent(new PointerEvent("pointerup",
								Object.assign(getEventOptions(hoverCandidate), {
									button: 0,
									buttons: 0,
								})
							));
							config.click(hoverCandidate);
							config.afterDispatch?.();
						}
					}
					hoverCandidate = null;
					deactivateForAtLeast(inactiveAfterHoveredTimespan);
				}
			}

			if (dwellDragging) {
				dwellIndicator.classList.add("tracky-mouse-for-release");
			} else {
				dwellIndicator.classList.remove("tracky-mouse-for-release");
			}
			dwellIndicator.style.display = "";
			dwellIndicator.style.opacity = circleOpacity;
			dwellIndicator.style.transform = `scale(${circleRadius / circleRadiusMax})`;
			dwellIndicator.style.left = `${circlePosition.x - circleRadiusMax / 2}px`;
			dwellIndicator.style.top = `${circlePosition.y - circleRadiusMax / 2}px`;

			let haloTarget =
				dwellDragging ||
				(hoverCandidate || getHoverCandidate(latestPoint.x, latestPoint.y) || {}).target;

			if (haloTarget && (!paused || config.dwellClickEvenIfPaused?.(haloTarget))) {
				let rect = haloTarget.getBoundingClientRect();
				const computedStyle = getComputedStyle(haloTarget);
				let ancestor = haloTarget;
				let borderRadiusScale = 1; // for border radius mimicry, given parents with transform: scale()
				while (ancestor instanceof HTMLElement) {
					const ancestorComputedStyle = getComputedStyle(ancestor);
					if (ancestorComputedStyle.transform) {
						// Collect scale transforms
						const match = ancestorComputedStyle.transform.match(/(?:scale|matrix)\((\d+(?:\.\d+)?)/);
						if (match) {
							borderRadiusScale *= Number(match[1]);
						}
					}
					if (ancestorComputedStyle.overflow !== "visible") {
						// Clamp to visible region if in scrollable area
						// This lets you see the hover halo when scrolled to the middle of a large canvas
						const scrollAreaRect = ancestor.getBoundingClientRect();
						rect = {
							left: Math.max(rect.left, scrollAreaRect.left),
							top: Math.max(rect.top, scrollAreaRect.top),
							right: Math.min(rect.right, scrollAreaRect.right),
							bottom: Math.min(rect.bottom, scrollAreaRect.bottom),
						};
						rect.width = rect.right - rect.left;
						rect.height = rect.bottom - rect.top;
					}
					ancestor = ancestor.parentNode;
				}
				halo.style.display = "block";
				halo.style.position = "fixed";
				halo.style.left = `${rect.left}px`;
				halo.style.top = `${rect.top}px`;
				halo.style.width = `${rect.width}px`;
				halo.style.height = `${rect.height}px`;
				// shorthand properties might not work in all browsers (not tested)
				// this is so overkill...
				// Maybe instead of collecting scale transforms and applying them to the border radii specifically,
				// just collect transforms in general and apply them to the halo element?
				// But of course getBoundingClientRect() includes transforms...
				for (const prop of [
					"borderTopRightRadius",
					"borderTopLeftRadius",
					"borderBottomRightRadius",
					"borderBottomLeftRadius",
				]) {
					// Unfortunately, getComputedStyle can return percentages, probably other units, probably also "auto"
					if (computedStyle[prop].endsWith("px")) {
						halo.style[prop] = `${parseFloat(computedStyle[prop]) * borderRadiusScale}px`;
					} else {
						halo.style[prop] = computedStyle[prop];
					}
				}
			} else {
				halo.style.display = "none";
			}

			if (time < inactiveUntilTime) {
				return;
			}
			if (recentMovementAmount < 5) {
				if (!hoverCandidate) {
					hoverCandidate = {
						x: averagePoint.x,
						y: averagePoint.y,
						time: performance.now(),
						target: dwellDragging || null,
					};
					if (!dwellDragging) {
						hoverCandidate = getHoverCandidate(hoverCandidate.x, hoverCandidate.y);
					}
					if (hoverCandidate && (paused && !config.dwellClickEvenIfPaused?.(hoverCandidate.target))) {
						hoverCandidate = null;
					}
				}
			}
			if (recentMovementAmount > 100) {
				if (dwellDragging) {
					config.beforeDispatch?.();
					window.dispatchEvent(new PointerEvent("pointerup",
						Object.assign(getEventOptions(averagePoint), {
							button: 0,
							buttons: 0,
						})
					));
					config.afterDispatch?.();
					config.afterReleaseDrag?.();
				}
			}
			if (recentMovementAmount > 60) {
				hoverCandidate = null;
			}
		}
	};
	let rafId;
	const animate = () => {
		rafId = requestAnimationFrame(animate);
		update();
	};
	rafId = requestAnimationFrame(animate);

	const dispose = () => {
		cancelAnimationFrame(rafId);
		halo.remove();
		dwellIndicator.remove();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUpOrCancel);
		window.removeEventListener("pointercancel", onPointerUpOrCancel);
		window.removeEventListener("focus", onFocus);
		window.removeEventListener("blur", onBlur);
		document.removeEventListener("mouseleave", onMouseLeavePage);
		document.removeEventListener("mouseenter", onMouseEnterPage);
	};

	const dwellClicker = {
		get paused() {
			return paused;
		},
		set paused(value) {
			paused = value;
		},
		dispose,
	};
	dwellClickers.push(dwellClicker);
	return dwellClicker;
};

TrackyMouse.initDwellClicking = function (config) {
	return initDwellClicking(config);
};
TrackyMouse.cleanupDwellClicking = function () {
	for (const dwellClicker of dwellClickers) {
		dwellClicker.dispose();
	}
};

TrackyMouse.init = function (div, { statsJs = false } = {}) {

	var uiContainer = div || document.createElement("div");
	uiContainer.classList.add("tracky-mouse-ui");
	uiContainer.innerHTML = `
		<div class="tracky-mouse-controls">
			<button class="tracky-mouse-start-stop-button" aria-pressed="false" aria-keyshortcuts="F9">Start</button>
		</div>
		<div class="tracky-mouse-canvas-container-container">
			<div class="tracky-mouse-canvas-container">
				<div class="tracky-mouse-canvas-overlay">
					<button class="tracky-mouse-use-camera-button">Allow Camera Access</button>
					<!--<button class="tracky-mouse-use-camera-button">Use my camera</button>-->
					<button class="tracky-mouse-use-demo-footage-button" hidden>Use demo footage</button>
					<div class="tracky-mouse-error-message" role="alert" hidden></div>
				</div>
				<canvas class="tracky-mouse-canvas"></canvas>
			</div>
		</div>
		<p class="tracky-mouse-desktop-app-download-message">
			You can control your entire computer with the <a href="https://trackymouse.js.org/">TrackyMouse</a> desktop app.
		</p>
	`;
	if (!div) {
		document.body.appendChild(uiContainer);
	}
	var startStopButton = uiContainer.querySelector(".tracky-mouse-start-stop-button");
	var useCameraButton = uiContainer.querySelector(".tracky-mouse-use-camera-button");
	var useDemoFootageButton = uiContainer.querySelector(".tracky-mouse-use-demo-footage-button");
	var errorMessage = uiContainer.querySelector(".tracky-mouse-error-message");
	var canvasContainer = uiContainer.querySelector('.tracky-mouse-canvas-container');
	var desktopAppDownloadMessage = uiContainer.querySelector('.tracky-mouse-desktop-app-download-message');

	// Settings (initialized later; defaults are defined in settingsCategories)
	const s = {};

	// Abstract model of settings UI.
	// Note: min, max, and default are in INPUT value units, not setting value units.
	// TODO: make min/max/default be in setting value units, and automatically define
	// input unit scale to avoid rounding to 0 or 1 for fractions (for example) - or use step?
	const settingsCategories = [
		{
			type: "group",
			label: "Cursor Movement",
			settings: [
				{
					label: "Tilt influence",
					className: "tracky-mouse-tilt-influence",
					key: "headTrackingTiltInfluence",
					settingValueToInputValue: (settingValue) => settingValue * 100,
					inputValueToSettingValue: (inputValue) => inputValue / 100,
					type: "slider",
					min: 0,
					max: 100,
					default: 0,
					labels: {
						// min: "Optical flow", // too technical
						// min: "Point tracking", // still technical but at least it's terminology we're already using
						min: "Point tracking (2D)",
						// max: "Head tilt",
						max: "Head tilt (3D)",
					},
					// description: "Determines whether cursor movement is based on 3D head tilt, or 2D motion of the face in the camera feed.",
					description: `Blends between using point tracking (2D) and detected head tilt (3D).
- At 0% it will use only point tracking. This moves the cursor according to visible movement of 2D points on your face within the camera's view, so it responds to both head rotation and translation.
- At 100% it will use only head tilt. This uses an estimate of your face's orientation in 3D space, and ignores head translation. Note that this is smoothed, so it's not as responsive as point tracking. In this mode you never need to recenter by pushing the cursor to the edge of the screen.
- In between it will behave like an automatic calibration, subtly adjusting the point tracking to match the head tilt. This works by slowing down mouse movement that is moving away from the position that would be expected based on the head tilt, and (only past 80% on the slider) actively moving towards it.`,
				},
				{
					label: "Motion threshold",
					className: "tracky-mouse-min-distance",
					key: "headTrackingMinDistance",
					type: "slider",
					min: 0,
					max: 10,
					default: 0,
					labels: {
						min: "Free",
						max: "Steady",
					},
					description: "Minimum distance to move the cursor in one frame, in pixels. Helps to fully stop the cursor.",
					// description: "Movement less than this distance in pixels will be ignored.",
					// description: "Speed in pixels/frame required to move the cursor.",
				},
				{
					type: "group",
					label: "Point tracking",
					disabled: () => s.headTrackingTiltInfluence === 1,
					settings: [
						{
							label: "Horizontal sensitivity",
							className: "tracky-mouse-sensitivity-x",
							key: "headTrackingSensitivityX",
							settingValueToInputValue: (settingValue) => settingValue * 1000,
							inputValueToSettingValue: (inputValue) => inputValue / 1000,
							type: "slider",
							min: 0,
							max: 100,
							default: 25,
							labels: {
								min: "Slow",
								max: "Fast",
							},
							description: "Speed of cursor movement in response to horizontal head movement.",
						},
						{
							label: "Vertical sensitivity",
							className: "tracky-mouse-sensitivity-y",
							key: "headTrackingSensitivityY",
							settingValueToInputValue: (settingValue) => settingValue * 1000,
							inputValueToSettingValue: (inputValue) => inputValue / 1000,
							type: "slider",
							min: 0,
							max: 100,
							default: 50,
							labels: {
								min: "Slow",
								max: "Fast",
							},
							description: "Speed of cursor movement in response to vertical head movement.",
						},
						// {
						// 	label: "Smoothing",
						// 	className: "tracky-mouse-smoothing",
						// 	key: "headTrackingSmoothing",
						// 	type: "slider",
						// 	min: 0,
						// 	max: 100,
						// 	default: 50,
						// 	labels: {
						// 		min: "Linear", // or "Direct", "Raw", "None"
						// 		max: "Smooth", // or "Smoothed"
						// 	},
						// },

						// TODO:
						// - eyeTrackingSensitivityX
						// - eyeTrackingSensitivityY
						// - eyeTrackingAcceleration

						// TODO: "Linear" could be described as "Fast", and the other "Fast" labels are on the other side.
						// Should it be swapped? What does other software with acceleration control look like?
						// In Windows it's just a checkbox apparently, but it could go as far as a custom curve editor.
						{
							label: "Acceleration",
							className: "tracky-mouse-acceleration",
							key: "headTrackingAcceleration",
							settingValueToInputValue: (settingValue) => settingValue * 100,
							inputValueToSettingValue: (inputValue) => inputValue / 100,
							type: "slider",
							min: 0,
							max: 100,
							default: 50,
							labels: {
								min: "Linear", // or "Direct", "Raw"
								max: "Smooth",
							},
							// description: "Higher acceleration makes the cursor move faster when the head moves quickly, and slower when the head moves slowly.",
							// description: "Makes the cursor move extra fast for quick head movements, and extra slow for slow head movements. Helps to stabilize the cursor.",
							description: `Makes the cursor move relatively fast for quick head movements, and relatively slow for slow head movements.
Helps to stabilize the cursor. However, when using point tracking in combination with head tilt, a lower value may work better since head tilt is linear, and you want the point tracking to roughly match the head tracking for it to act as a seamless auto- calibration.`,
						},
					],
				},
				{
					type: "group",
					label: "Head tilt calibration",
					disabled: () => s.headTrackingTiltInfluence === 0,
					settings: [
						{
							label: "Horizontal tilt range",
							className: "tracky-mouse-head-tilt-yaw-range",
							key: "headTiltYawRange",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: 10,
							max: 90,
							default: 60,
							labels: {
								min: "Little neck movement",
								max: "Large neck movement",
							},
							// description: "Range of horizontal head tilt that moves the cursor from one side of the screen to the other.",
							// description: "How much you need to tilt your head left and right to reach the edges of the screen.",
							// description: "How much you need to tilt your head left or right to reach the edge of the screen.",
							description: "Controls how much you need to tilt your head left or right to reach the edge of the screen.",
						},
						{
							label: "Vertical tilt range",
							className: "tracky-mouse-head-tilt-pitch-range",
							key: "headTiltPitchRange",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: 10,
							max: 60,
							default: 25,
							labels: {
								min: "Little neck movement",
								max: "Large neck movement",
							},
							// description: "Range of vertical head tilt required to move the cursor from the top to the bottom of the screen.",
							// description: "How much you need to tilt your head up and down to reach the edges of the screen.",
							// description: "How much you need to tilt your head up or down to reach the edge of the screen.",
							description: "Controls how much you need to tilt your head up or down to reach the edge of the screen.",
						},
						{
							// label: "Horizontal tilt offset",
							label: "Horizontal cursor offset",
							className: "tracky-mouse-head-tilt-yaw-offset",
							key: "headTiltYawOffset",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: -45,
							max: 45,
							default: 0,
							labels: {
								min: "Left",
								max: "Right",
							},
							// TODO: how to describe this??
							// Specifically, how to disambiguate which direction is which / which way to adjust it?
							// And shouldn't the option behave opposite? I think we have pitch yaw and roll all reversed from standard aviation definitions.
							// Since it's opposite, even though it's technically yaw (angle units), it's easier to think of as moving the cursor.
							// Hence I've renamed the setting.
							// A later update might change the definitions and include a settings file format upgrade step.
							// description: "Adjusts the center position of horizontal head tilt. Not recommended. Move the camera instead if possible.",
							// description: "Adjusts the center position of horizontal head tilt. This horizontal offset is not recommended. Move the camera instead if possible.",
							// TODO: should this say "horizontal" in the (main part of the) description?
							description: `Adjusts the position of the cursor when the camera sees the head facing straight ahead.
⚠️ This horizontal offset is not recommended. Move the camera instead if possible. 📷`,
						},
						{
							// label: "Vertical tilt offset",
							label: "Vertical cursor offset",
							className: "tracky-mouse-head-tilt-pitch-offset",
							key: "headTiltPitchOffset",
							settingValueToInputValue: (settingValue) => settingValue * 180 / Math.PI,
							inputValueToSettingValue: (inputValue) => inputValue * Math.PI / 180,
							type: "slider",
							min: -30,
							max: 30,
							default: 2.5,
							labels: {
								min: "Down",
								max: "Up",
							},
							// description: "Adjusts the center position of vertical head tilt.",
							description: `Adjusts the position of the cursor when the camera sees the head facing straight ahead.`,
						},
					],
				},
			],
		},

		// Only dwell clicking is supported by the web library right now.
		// Currently it's a separate API (TrackyMouse.initDwellClicking)
		// TODO: bring more of desktop app functionality into core
		// https://github.com/1j01/tracky-mouse/issues/72

		// Also, the "Swap mouse buttons" setting is likely not useful for
		// web apps embedding Tracky Mouse and designed for head trackers,
		// since it necessitates mode switching for dwell clicker usage,
		// so it may make sense to hide (or not) even if it is supported there in the future.
		// The main point of this option is to counteract the system-level mouse button setting,
		// which awkwardly affects what mouse button serenade-driver sends; this doesn't affect the web version.
		{
			type: "group",
			label: "Clicking",
			settings: [
				{
					label: "Clicking mode:", // TODO: ":"?
					className: "tracky-mouse-clicking-mode",
					key: "clickingMode",
					type: "dropdown",
					options: [
						{ value: "dwell", label: "Dwell to click" },
						{ value: "blink", label: "Wink to click" },
						{ value: "open-mouth", label: "Open mouth to click" },
						{ value: "off", label: "Off" },
					],
					default: "dwell",
					platform: "desktop",
					description: `Choose how to perform mouse clicks.
- Dwell to click: Hold the cursor in place for a short time to click.
- Wink to click: Close one eye to click. Left eye for left click, right eye for right click.
- Open mouth to click: Open your mouth wide to click. If left eye is closed, it's a right click; if right eye is closed, it's a middle click.
- Off: Disable clicking. Use with an external switch or programs that provide their own dwell clicking.`,
				},
				{
					// on Windows, currently, when buttons are swapped at the system level, it affects serenade-driver's click()
					// "swap" is purposefully generic language so we don't have to know what system-level setting is
					// (also this may be seen as a weirdly named/designed option for right-clicking with the dwell clicker)
					label: "Swap mouse buttons",
					className: "tracky-mouse-swap-mouse-buttons",
					key: "swapMouseButtons",
					type: "checkbox",
					default: false,
					platform: "desktop",
					description: `Switches the left and right mouse buttons.
Useful if your system's mouse buttons are swapped.
Could also be used to right click with the dwell clicker in a pinch.`,
				},

				// This setting could called "click stabilization", "drag delay", "delay before dragging", "click drag delay", "drag prevention", etc.
				// with slider labels "Easy to click -> Easy to drag" or "Easier to click -> Easier to drag" or "Short -> Long"
				// This could generalize into "never allow dragging" at the extreme, if it's special cased to jump to infinity
				// at the end of the slider, although you shouldn't need to do that to effectively avoid dragging when trying to click,
				// and it might complicate the design of the slider labeling.
				{
					label: "Delay before dragging&nbsp;&nbsp;&nbsp;", // TODO: avoid non-breaking space hack
					className: "tracky-mouse-delay-before-dragging",
					key: "delayBeforeDragging",
					type: "slider",
					min: 0,
					max: 1000,
					labels: {
						min: "Easy to drag",
						max: "Easy to click",
					},
					default: 0, // TODO: increase default
					platform: "desktop",
					disabled: () => s.clickingMode === "off" || s.clickingMode === "dwell",
					// description: "Locks mouse movement during the start of a click to prevent accidental dragging.",
					// description: `Prevents mouse movement for the specified time after a click starts.
					// You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.`,
					description: `Locks mouse movement for the given duration during the start of a click.
You may want to turn this off if you're drawing on a canvas, or increase it if you find yourself accidentally dragging when you try to click.`,
				},
			],
		},
		{
			type: "group",
			label: "Video",
			settings: [
				{
					label: "Camera source",
					className: "tracky-mouse-camera-select",
					key: "cameraDeviceId",
					handleSettingChange: () => {
						TrackyMouse.useCamera();
					},
					type: "dropdown",
					options: [
						{ value: "", label: "Default" },
					],
					default: "",
					// description: "Select which camera to use for head tracking.",
					description: "Selects which camera is used for head tracking.",
				},
				// TODO: move this inline with the camera source dropdown?
				{
					label: "Open Camera Settings",
					className: "tracky-mouse-open-camera-settings",
					key: "openCameraSettings",
					type: "button",
					platform: "desktop",
					onClick: async () => {
						let knownCameras = {};
						try {
							knownCameras = JSON.parse(localStorage.getItem("tracky-mouse-known-cameras")) || {};
						} catch (error) {
							alert("Failed to open camera settings:\n" + "Failed to parse known cameras from localStorage:\n" + error.message);
							return;
						}

						const activeStream = cameraVideo.srcObject;
						const activeDeviceId = activeStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
						const selectedDeviceName = knownCameras[activeDeviceId]?.name || "Default";

						try {
							const result = await window.electronAPI.openCameraSettings(selectedDeviceName);
							if (result?.error) {
								alert("Failed to open camera settings:\n" + result.error);
							}
						} catch (error) {
							alert("Failed to open camera settings:\n" + error.message);
						}
					},
					// description: "Open your camera's system settings window to adjust properties like brightness and contrast.",
					// description: "Opens the system settings window for your camera to adjust properties like auto-focus and auto-exposure.",
					description: "Opens the system settings dialog for the selected camera, to adjust properties like auto-focus and auto-exposure.",
				},
				// TODO: try moving this to the corner of the camera view, so it's clearer it applies only to the camera view
				{
					label: "Mirror",
					className: "tracky-mouse-mirror",
					key: "mirror",
					type: "checkbox",
					default: true,
					description: "Mirrors the camera view horizontally.",
				},
			]
		},
		{
			type: "group",
			label: "General",
			settings: [
				// opposite, "Start paused", might be clearer, especially if I add a "pause" button
				{
					label: "Start enabled",
					className: "tracky-mouse-start-enabled",
					key: "startEnabled",
					afterInitialLoad: () => { // TODO: does this hook make sense? right now it's the only usage. could this code not just be called later?
						paused = !s.startEnabled;
					},
					type: "checkbox",
					default: false,
					description: "If enabled, Tracky Mouse will start controlling the cursor as soon as it's launched.",
					// description: "Makes Tracky Mouse active when launched. Otherwise, you can start it manually when you're ready.",
					// description: "Makes Tracky Mouse active as soon as it's launched.",
					// description: "Automatically starts Tracky Mouse as soon as it's run.",
				},
				{
					// For "experimental" label:
					// - I'm preferring language that doesn't assume a new build is coming soon, fixing everything
					// - I considered adding "⚠︎" but it feels a little too alarming
					// label: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"Planned refinements include: visual and auditory feedback, improved detection accuracy, and separate settings for durations to toggle on and off.\">experimental</span>)",
					// label: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"• Missing visual and auditory feedback.\n• Missing settings for duration(s) to toggle on and off.\n• Affected by false positive blink detections, especially when looking downward.\">Experimental</span>)",
					label: "Close eyes to start/stop (<span style=\"border-bottom: 1px dotted;\" title=\"• There is currently no visual or auditory feedback.\n• There are no settings for duration(s) to toggle on and off.\n• It is affected by false positive blink detections, especially when looking downward.\">Experimental</span>)",
					className: "tracky-mouse-close-eyes-to-toggle",
					key: "closeEyesToToggle",
					type: "checkbox",
					default: false,
					description: "If enabled, you can start or stop mouse control by holding both your eyes shut for a few seconds.",
				},
				{
					label: "Run at login",
					className: "tracky-mouse-run-at-login",
					key: "runAtLogin",
					type: "checkbox",
					default: false,
					platform: "desktop",
					description: "If enabled, Tracky Mouse will automatically start when you log into your computer.",
					// description: "Makes Tracky Mouse start automatically when you log into your computer.",
				},
				{
					label: "Check for updates",
					className: "tracky-mouse-check-for-updates",
					key: "checkForUpdates",
					type: "checkbox",
					default: true,
					platform: "desktop",
					description: "If enabled, Tracky Mouse will automatically check for updates when it starts.",
					// description: "Notifies you of new versions of Tracky Mouse.",
					// description: "Notifies you when a new version of Tracky Mouse is available.",
				},
			],
		},
	];

	function traverseSettings(settings, callback, parentGroup = null) {
		for (const setting of settings) {
			callback(setting, parentGroup);
			if (setting.type === "group") {
				traverseSettings(setting.settings, callback, setting);
			}
		}
	}

	const elsByGroup = new Map();
	const functionsToUpdateDisabledStates = [];

	function buildSettingsUI(parentEl, settingsCategories) {

		for (const category of settingsCategories) {
			const detailsEl = buildSettingGroupUI(category);
			const bodyEl = detailsEl.querySelector(".tracky-mouse-details-body");
			traverseSettings(category.settings, (setting, parentGroup) => {
				const parentGroupElement = (elsByGroup.get(parentGroup) ?? bodyEl);

				let el;
				if (setting.type === "group") {
					el = buildSettingGroupUI(setting);
				} else {
					el = buildSettingItemUI(setting);
				}
				parentGroupElement.appendChild(el);

				if (setting.disabled) {
					const updateDisabledState = () => {
						// TODO: supply a message for why it's disabled (can update `disabled()` to return a string or object)
						const disabled = setting.disabled?.() ?? setting.disabled === true;
						el.classList.toggle("tracky-mouse-disabled", disabled);
						const controls = el.querySelectorAll(`input, select, button`);
						for (const control of controls) {
							// This should handle nested disabled conditions properly
							control.disabled = control.closest(".tracky-mouse-disabled") !== null;
						}
					};
					functionsToUpdateDisabledStates.push(updateDisabledState);
					// Not useful to call updateDisabledState() here because dependent setting values aren't loaded yet
				}
			});

			parentEl.appendChild(detailsEl);

		}

	}

	function buildSettingGroupUI(group) {
		const detailsEl = document.createElement("details");
		// detailsEl.className = "tracky-mouse-settings-group";
		// TODO: recursive check for platform - or just define platform on groups
		if (group.settings.every(setting => setting.platform === "desktop")) {
			detailsEl.classList.add("tracky-mouse-desktop-only");
		}
		const summaryEl = document.createElement("summary");
		summaryEl.textContent = group.label;
		detailsEl.appendChild(summaryEl);
		const bodyEl = document.createElement("div");
		bodyEl.className = "tracky-mouse-details-body";
		detailsEl.appendChild(bodyEl);
		elsByGroup.set(group, bodyEl);
		return detailsEl;
	}

	function buildSettingItemUI(setting) {

		// Validation
		for (const requiredProp of ["label", "className", "key", "type", "default"]) {
			if (setting[requiredProp] === undefined) {
				if (setting.type === "button" && requiredProp === "default") {
					continue; // buttons don't need a default value
				}
				console.warn(`Setting is missing ${requiredProp}:`, setting);
				return;
			}
		}
		for (const importantProp of ["description"]) {
			if (setting[importantProp] === undefined) {
				console.warn(`Setting is missing ${importantProp}:`, setting);
			}
		}

		// TODO: consider making everything use <label for=""> inside and <div> outside
		const rowEl = document.createElement(setting.type === "slider" ? "label" : "div");
		rowEl.className = "tracky-mouse-control-row";
		if (setting.type === "slider") {
			rowEl.innerHTML = `
				<span class="tracky-mouse-label-text">${setting.label}</span>
				<span class="tracky-mouse-labeled-slider">
					<input type="range" min="${setting.min}" max="${setting.max}" class="${setting.className}">
					<span class="tracky-mouse-slider-labels">
						<span class="tracky-mouse-min-label">${setting.labels.min}</span>
						<span class="tracky-mouse-max-label">${setting.labels.max}</span>
					</span>
				</span>
			`;
		} else if (setting.type === "checkbox") {
			// special interest: jspaint wants label not to use parent-child relationship so that os-gui's 98.css checkbox styles can work
			rowEl.innerHTML = `
				<input type="checkbox" id="${setting.className}" class="${setting.className}">
				<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
			`;
		} else if (setting.type === "dropdown") {
			const optionsHtml = setting.options.map(option => `
				<option value="${option.value}">${option.label}</option>
			`.trim()).join("\n");
			rowEl.innerHTML = `
				<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
				<select id="${setting.className}" class="${setting.className}">
					${optionsHtml}
				</select>
			`;
		} else if (setting.type === "button") {
			rowEl.innerHTML = `
				<button class="${setting.className}">${setting.label}</button>
			`;
		}
		if (setting.platform === "desktop") {
			rowEl.classList.add("tracky-mouse-desktop-only");
		}

		if (setting.description) {
			// Tooltip; TODO: try an ⓘ info icon button with a popover
			rowEl.setAttribute("title", setting.description);
		}

		const control = rowEl.querySelector(`.${setting.className}`);
		const getControlValue = () => {
			if (setting.type === "slider") {
				return Number(control.value);
			} else if (setting.type === "checkbox") {
				return control.checked;
			} else if (setting.type === "dropdown") {
				return control.value;
			}
		};
		const setControlValue = (value) => {
			if (setting.type === "slider") {
				control.value = value;
			} else if (setting.type === "checkbox") {
				control.checked = value;
			} else if (setting.type === "dropdown") {
				control.value = value;
			}
		};

		const load = (settings, initialLoad) => {
			// Note: Don't use `... in settings.globalSettings` to check if a setting is defined.
			// We must ignore `undefined` values so that the defaults carry over from the renderer to the main process in the Electron app.
			if (settings.globalSettings?.[setting.key] !== undefined) {
				s[setting.key] = settings.globalSettings[setting.key];
				setControlValue((setting.settingValueToInputValue ?? ((x) => x))(s[setting.key]));
			}
			if (initialLoad) {
				setting.afterInitialLoad?.();
			}
		};
		const loadValueFromControl = () => {
			s[setting.key] = (setting.inputValueToSettingValue ?? ((x) => x))(getControlValue());
		};
		const save = () => {
			setOptions({ globalSettings: { [setting.key]: s[setting.key] } });
		};

		// Load defaults
		// currently defined in input value units
		setControlValue(setting.default);
		s[setting.key] = (setting.inputValueToSettingValue ?? ((x) => x))(getControlValue());
		// Not useful to call functionsToUpdateDisabledStates here because dependent setting values aren't necessarily loaded yet

		// Handle changes
		control.addEventListener("change", () => {
			loadValueFromControl();
			save();
			// TODO: also call this if the setting is changed through CLI
			// Would be good to have a pattern where it's subscribing to changes to a settings store
			setting.handleSettingChange?.();

			for (const func of functionsToUpdateDisabledStates) {
				func();
			}
		});
		// Handle loading from stored settings
		setting._load = load;

		if (setting.type === "button") {
			control.addEventListener("click", () => {
				setting.onClick?.();
			});
		}

		return rowEl;
	}

	buildSettingsUI(uiContainer.querySelector(".tracky-mouse-controls"), settingsCategories);

	const runAtLoginCheckbox = uiContainer.querySelector(".tracky-mouse-run-at-login");
	const swapMouseButtonsCheckbox = uiContainer.querySelector(".tracky-mouse-swap-mouse-buttons");
	const swapMouseButtonsLabel = uiContainer.querySelector("label[for='tracky-mouse-swap-mouse-buttons']");
	const cameraSelect = uiContainer.querySelector(".tracky-mouse-camera-select");

	if (window.electronAPI) {
		// Hide the desktop app download message if we're in the desktop app
		// Might be good to also hide it, or change it, when on a mobile device
		desktopAppDownloadMessage.hidden = true;

		// Disable the "run at login" option if the app isn't packaged,
		// as it's not set up to work in development mode.
		window.electronAPI.getIsPackaged().then((isPackaged) => {
			runAtLoginCheckbox.disabled = !isPackaged;
		});
	} else {
		for (const elementToHide of uiContainer.querySelectorAll('.tracky-mouse-desktop-only')) {
			elementToHide.hidden = true;
		}
	}

	var canvas = uiContainer.querySelector(".tracky-mouse-canvas");
	var ctx = canvas.getContext('2d');

	var debugEyeCanvas = document.createElement("canvas");
	debugEyeCanvas.className = "tracky-mouse-debug-eye-canvas";
	debugEyeCanvas.style.display = "none";
	uiContainer.querySelector(".tracky-mouse-canvas-container-container").appendChild(debugEyeCanvas);
	var debugEyeCtx = debugEyeCanvas.getContext('2d');

	var pointerEl = document.createElement('div');
	pointerEl.className = "tracky-mouse-pointer";
	pointerEl.style.display = "none";
	document.body.appendChild(pointerEl);

	var cameraVideo = document.createElement('video');
	// required to work in iOS 11 & up:
	cameraVideo.setAttribute('playsinline', '');

	if (statsJs) {
		var stats = new Stats();
		stats.domElement.style.position = 'fixed';
		stats.domElement.style.top = '0px';
		stats.domElement.style.right = '0px';
		stats.domElement.style.left = '';
		document.body.appendChild(stats.domElement);
	}

	// Debug flags (not shown in the UI; could become Advanced Settings in the future)
	var debugAcceleration = false;
	var showDebugText = false;
	var showDebugEyeZoom = false;
	var showDebugHeadTilt = false;

	// Constants (could become Advanced Settings in the future)
	var defaultWidth = 640;
	var defaultHeight = 480;
	var maxPoints = 1000;
	var faceScoreThreshold = 0.5;
	var facemeshOptions = {
		maxContinuousChecks: 5,
		detectionConfidence: 0.9,
		maxFaces: 1,
		iouThreshold: 0.3,
		scoreThreshold: 0.75
	};
	var useFacemesh = true;
	// maybe should be based on size of head in view?
	const pruningGridSize = 5;
	const minDistanceToAddPoint = pruningGridSize * 1.5;

	// Head tracking and facial gesture state
	// ## Clmtrackr state
	var face;
	var faceScore = 0;
	var faceConvergence = 0;
	// var faceConvergenceThreshold = 50;
	var pointsBasedOnFaceScore = 0;
	// ## Facemesh state
	let detector;
	let currentCameraImageData;
	var facemeshLoaded = false;
	var facemeshFirstEstimation = true;
	var facemeshEstimating = false;
	var facemeshRejectNext = 0;
	var facemeshPrediction;
	var facemeshEstimateFaces;
	var faceInViewConfidenceThreshold = 0.7;
	var pointsBasedOnFaceInViewConfidence = 0;
	var cameraFramesSinceFacemeshUpdate = [];
	var blinkInfo;
	var mouthInfo;
	var headTilt = { pitch: 0, yaw: 0, roll: 0 };
	var headTiltFilters = { pitch: null, yaw: null, roll: null };
	var lastTimeWhenAnEyeWasOpen = Infinity; // far future rather than far past so that sleep gesture doesn't trigger initially, skipping the delay
	// ## State related to switching between head trackers
	var useClmTracking = true;
	var showClmTracking = useClmTracking;
	var fallbackTimeoutID;

	// Mouse state
	var mouseX = 0;
	var mouseY = 0;
	var buttonStates = {
		left: false,
		right: false,
		middle: false,
	};
	var mouseButtonUntilMouthCloses = -1;
	var lastMouseDownTime = -Infinity;
	var mouseNeedsInitPos = true;

	// Other state
	var paused = true;
	var pointTracker;

	// Named lists of facemesh landmark indices
	const MESH_ANNOTATIONS = {
		silhouette: [
			10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
			397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
			172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
		],

		lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
		lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
		lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
		lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],

		rightEyeUpper0: [246, 161, 160, 159, 158, 157, 173],
		rightEyeLower0: [33, 7, 163, 144, 145, 153, 154, 155, 133],
		rightEyeUpper1: [247, 30, 29, 27, 28, 56, 190],
		rightEyeLower1: [130, 25, 110, 24, 23, 22, 26, 112, 243],
		rightEyeUpper2: [113, 225, 224, 223, 222, 221, 189],
		rightEyeLower2: [226, 31, 228, 229, 230, 231, 232, 233, 244],
		rightEyeLower3: [143, 111, 117, 118, 119, 120, 121, 128, 245],

		rightEyebrowUpper: [156, 70, 63, 105, 66, 107, 55, 193],
		rightEyebrowLower: [35, 124, 46, 53, 52, 65],

		rightEyeIris: [473, 474, 475, 476, 477],

		leftEyeUpper0: [466, 388, 387, 386, 385, 384, 398],
		leftEyeLower0: [263, 249, 390, 373, 374, 380, 381, 382, 362],
		leftEyeUpper1: [467, 260, 259, 257, 258, 286, 414],
		leftEyeLower1: [359, 255, 339, 254, 253, 252, 256, 341, 463],
		leftEyeUpper2: [342, 445, 444, 443, 442, 441, 413],
		leftEyeLower2: [446, 261, 448, 449, 450, 451, 452, 453, 464],
		leftEyeLower3: [372, 340, 346, 347, 348, 349, 350, 357, 465],

		leftEyebrowUpper: [383, 300, 293, 334, 296, 336, 285, 417],
		leftEyebrowLower: [265, 353, 276, 283, 282, 295],

		leftEyeIris: [468, 469, 470, 471, 472],

		midwayBetweenEyes: [168],

		noseTip: [1],
		noseBottom: [2],
		noseRightCorner: [98],
		noseLeftCorner: [327],

		rightCheek: [205],
		leftCheek: [425]
	};


	const initFacemesh = async () => {
		if (detector) {
			detector.dispose();
		}
		facemeshEstimating = false;
		facemeshFirstEstimation = true;
		facemeshLoaded = false;
		const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
		const detectorConfig = {
			runtime: 'mediapipe',
			solutionPath: `${TrackyMouse.dependenciesRoot}/lib/face_mesh`,
			refineLandmarks: true,
		};

		try {
			detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
		} catch (error) {
			detector = null;
			// TODO: avoid alert
			console.error("Failed to create facemesh detector:", error);
			alert(error);
		}

		facemeshLoaded = true;
		facemeshEstimateFaces = async () => {
			const imageData = currentCameraImageData;//getCameraImageData();
			if (!imageData) {
				return [];
			}
			try {
				const faces = await detector.estimateFaces(imageData, { flipHorizontal: false });
				if (!faces) {
					console.warn("faces ===", faces);
					return [];
				}
				return faces;
			} catch (error) {
				detector.dispose();
				detector = null;
				// TODO: avoid alert
				console.error("Facemesh estimation failed:", error);
				alert(error);
			}
			return [];
		};

	};

	if (useFacemesh) {
		initFacemesh();
	}

	function deserializeSettings(settings, initialLoad = false) {
		// TODO: DRY with deserializeSettings in electron-main.js
		for (const category of settingsCategories) {
			traverseSettings(category.settings, (setting) => {
				setting._load?.(settings, initialLoad);
			});
		}

		// Now that all settings are loaded, update disabled states
		for (const func of functionsToUpdateDisabledStates) {
			func();
		}

	}
	const formatVersion = 1;
	const formatName = "tracky-mouse-settings";
	function serializeSettings() {
		// TODO: DRY with serializeSettings in electron-main.js
		// The important part is done (don't need to list every setting here - or there),
		// but we could still switch to using IPC for saving/loading serialized settings
		// eliminating the duplicate format handling, which may become more complex over time.
		// The main process will still want to know about _some_ settings, and this shouldn't go through the serialization,
		// but that can remain using the existing IPC calls while we add new ones dealing with serialized settings.
		// (So I guess this is really a todo for the electron app; maybe this sort of detailed comment would make more sense there.)
		return {
			formatVersion,
			formatName,
			globalSettings: s,
			// profiles: [],
		};
	};
	const setOptions = (options) => {
		if (window.electronAPI) {
			window.electronAPI.setOptions(options);
		} else {
			try {
				localStorage.setItem("tracky-mouse-settings", JSON.stringify(serializeSettings(), null, "\t"));
			} catch (e) {
				console.error(e);
			}
		}
	};
	const loadOptions = async (initialLoad = false) => {
		if (window.electronAPI) {
			deserializeSettings(await window.electronAPI.getOptions(), initialLoad);
		} else {
			try {
				if (localStorage.getItem("tracky-mouse-settings")) {
					deserializeSettings(JSON.parse(localStorage.getItem("tracky-mouse-settings")), initialLoad);
				}
			} catch (e) {
				console.error(e);
			}
		}
	};

	paused = !s.startEnabled;

	// Basically Promise.withResolvers (but I'm not sure browser support is good enough)
	function createDeferred() {
		let resolve, reject;
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	}

	let matchedCameraIdDeferred = createDeferred();
	let populateCameraList = () => { };
	if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
		populateCameraList = () => {
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				const videoDevices = devices.filter(device => device.kind === 'videoinput');

				let knownCameras = {};
				try {
					knownCameras = JSON.parse(localStorage.getItem("tracky-mouse-known-cameras")) || {};
				} catch (error) {
					console.error("Failed to parse known cameras from localStorage", error);
				}
				let knownCamerasChanged = false;
				for (const device of videoDevices) {
					if (device.deviceId && device.label) {
						if (!knownCameras[device.deviceId] || knownCameras[device.deviceId].name !== device.label) {
							knownCameras[device.deviceId] = { name: device.label };
							knownCamerasChanged = true;
						}
					}
				}
				if (knownCamerasChanged) {
					try {
						localStorage.setItem("tracky-mouse-known-cameras", JSON.stringify(knownCameras));
					} catch (error) {
						console.error("Failed to store known cameras in localStorage", error);
					}
				}

				cameraSelect.innerHTML = "";

				const defaultOption = document.createElement("option");
				defaultOption.value = "";
				defaultOption.text = "Default";
				cameraSelect.appendChild(defaultOption);

				let matchingDeviceId = "";
				for (const device of videoDevices) {
					const option = document.createElement('option');
					option.value = device.deviceId;
					option.text = device.label || `Camera ${cameraSelect.length}`;
					cameraSelect.appendChild(option);
					if (device.deviceId === s.cameraDeviceId) {
						matchingDeviceId = device.deviceId;
					} else if (device.label === knownCameras[s.cameraDeviceId]?.name) {
						matchingDeviceId ||= device.deviceId;
					}
				}

				// Defaulting to "Default" would imply a preference isn't stored...
				// but would it be more friendly anyways?
				// cameraSelect.value = found ? s.cameraDeviceId : "";

				// Show a placeholder for the selected camera
				if (s.cameraDeviceId && !matchingDeviceId) {
					const option = document.createElement("option");
					option.value = s.cameraDeviceId;
					const knownInfo = knownCameras[s.cameraDeviceId];
					option.text = knownInfo ? `${knownInfo.name} (Unavailable)` : "Unavailable camera";
					cameraSelect.appendChild(option);
					cameraSelect.value = s.cameraDeviceId;
				} else {
					cameraSelect.value = matchingDeviceId;
				}
				matchedCameraIdDeferred.resolve(matchingDeviceId);
			});
		};
		populateCameraList();
		navigator.mediaDevices.addEventListener('devicechange', populateCameraList);
	}

	// Handle right click on "swap mouse buttons", so it doesn't leave users stranded right-clicking.
	// Note that if you click outside the application window, hiding it behind another window, or minimize it,
	// you can still be left in a tricky situation.
	// A more general safety net would be a "revert changes?" timer (https://github.com/1j01/tracky-mouse/issues/43)
	// But this is good to have in any case, since you don't want to have to wait for a timeout if you don't have to.
	for (const el of [swapMouseButtonsLabel, swapMouseButtonsCheckbox]) {
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			swapMouseButtonsCheckbox.checked = !swapMouseButtonsCheckbox.checked;
			swapMouseButtonsCheckbox.dispatchEvent(new Event("change"));
		});
	}

	const settingsLoadedPromise = loadOptions(true);

	// Don't use WebGL because clmTracker is our fallback! It's also not much slower than with WebGL.
	var clmTracker = new clm.tracker({ useWebGL: false });
	clmTracker.init();
	var clmTrackingStarted = false;

	const stopCameraStream = () => {
		if (cameraVideo.srcObject) {
			for (const track of cameraVideo.srcObject.getTracks()) {
				track.stop();
			}
		}
		cameraVideo.srcObject = null;
	};

	const reset = () => {
		stopCameraStream();
		clmTrackingStarted = false;
		cameraFramesSinceFacemeshUpdate.length = 0;
		if (facemeshPrediction) {
			// facemesh has a setting maxContinuousChecks that determines "How many frames to go without running
			// the bounding box detector. Only relevant if maxFaces > 1. Defaults to 5."
			facemeshRejectNext = facemeshOptions.maxContinuousChecks;
		}
		facemeshPrediction = null;
		useClmTracking = true;
		showClmTracking = true;
		pointsBasedOnFaceScore = 0;
		faceScore = 0;
		faceConvergence = 0;
		lastTimeWhenAnEyeWasOpen = Infinity; // far future rather than far past so that sleep gesture doesn't trigger initially, skipping the delay
		updateStartStopButton();
	};

	useCameraButton.onclick = TrackyMouse.useCamera = async (optionsOrEvent) => {
		await settingsLoadedPromise;
		const constraints = {
			audio: false,
			video: {
				width: defaultWidth,
				height: defaultHeight,
				facingMode: "user",
			}
		};
		const deviceIdToTry = optionsOrEvent?.retryWithCameraDeviceId ?? s.cameraDeviceId;
		if (deviceIdToTry) {
			delete constraints.video.facingMode;
			constraints.video.deviceId = { exact: deviceIdToTry };
		}
		navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
			populateCameraList();
			reset();

			cameraVideo.srcObject = stream;
			useCameraButton.hidden = true;
			errorMessage.hidden = true;
		}, async (error) => {

			// OverconstrainedError can be caused by `deviceId` not matching,
			// either due to the device not being present, or the ID having changed (don't ask me why that can happen but it can)
			// Note: OverconstrainedError has a `constraint` property but not in Firefox so it's not very helpful.
			// Note: (Not sure about ConstraintNotSatisfiedError here)
			if (
				(error.name === "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") &&
				constraints.video.deviceId?.exact
			) {
				// This is giving me User Gesture Hinged Access And Access Attempt Absorption Anxiety,
				// or "UGHAaAAAA" (I'm coining that term)
				const matchedCameraId = await matchedCameraIdDeferred.promise;
				if (matchedCameraId) {
					// TODO: make sure matchedCameraId !== deviceIdToTry
					TrackyMouse.useCamera({ retryWithCameraDeviceId: matchedCameraId });
				} else {
					// TODO: unify code branches for error handling

					// TODO: handle case where permission is no longer granted,
					// and enumerateDevices returns a fake list
					// and getUserMedia fails with OverconstrainedError when passed a real deviceId because it's not in the fake list
					// It's possible we could connect to the device without the user having to change the device
					// in the dropdown (twice, in case they want a non-default camera)
					// by first calling getUserMedia with no deviceId constraint, then closing the stream,
					// then enumerating devices (and updating the dropdown with the real info)
					// and calling getUserMedia again with the deviceId from the settings.
					// The user should only need to respond to a permissions prompt once.

					console.error(error, { matchedCameraId, "s.cameraDeviceId": s.cameraDeviceId, knownCameras: JSON.parse(localStorage.getItem("tracky-mouse-known-cameras") || "{}"), videoDevices: await navigator.mediaDevices.enumerateDevices() });
					// errorMessage.textContent = "The previously selected camera is not available. Please select a different camera from the dropdown and try again.";
					// errorMessage.textContent = "The previously selected camera is not available. Please mess around with Video > Camera source.";
					// errorMessage.textContent = "The previously selected camera is not available. Try changing Video > Camera source.";
					// errorMessage.textContent = "The previously selected camera is not available. Please select a camera from the \"Camera source\" dropdown in the Video settings and if it doesn't show up, it might after you select Default.";
					errorMessage.textContent = "The previously selected camera is not available. Try selecting \"Default\" for Video > Camera source, and then select a specific camera if you need to.";
					// It's awkward but that's my best attempt at conveying how you may need to proceed
					// without complicated description of how/why the dropdown might be populated with
					// fake information until a camera stream is successfully opened.
					errorMessage.textContent = `⚠️ ${errorMessage.textContent}`;
					errorMessage.hidden = false;
				}
				return;
			}

			console.log(error);
			if (error.name == "NotFoundError" || error.name == "DevicesNotFoundError") {
				// required track is missing
				errorMessage.textContent = "No camera found. Please make sure you have a camera connected and enabled.";
			} else if (error.name == "NotReadableError" || error.name == "TrackStartError") {
				// webcam is already in use
				// or: OBS Virtual Camera is present but OBS is not running with Virtual Camera started
				// TODO: enumerateDevices and give more specific message for OBS Virtual Camera case
				// (listing devices and showing only the OBS Virtual Camera would also be a good clue in itself;
				// though care should be given to make it clear it's a list with one item, with something like "(no more cameras detected)" following the list
				// or "1 camera source detected" preceding it)
				errorMessage.textContent = "Webcam is already in use. Please make sure you have no other programs using the camera.";
			} else if (error.name === "AbortError") {
				// webcam is likely already in use
				// I observed AbortError in Firefox 132.0.2 but I don't know it's used exclusively for this case.
				// Update: it definitely isn't, but I can't say exactly what it means in other cases.
				// Like, it might have to do with permissions being denied outside of a user gesture (distinct from the user denying the permission)
				// I really hope that isn't the problem.
				// errorMessage.textContent = "Webcam may already be in use. Please make sure you have no other programs using the camera.";
				errorMessage.textContent = "Please make sure no other programs are using the camera and try again.";
				// A more honest/helpful message might be:
				// errorMessage.textContent = "Please try again and then make sure no other programs are using the camera and try again again.";
				// errorMessage.textContent = "Please try again before/after making sure no other programs are using the camera.";
				// if it were not to be confusing.
				// That is, one could save some time by just hitting the button to try again before trying to figure out of another program is using the camera,
				// because sometimes that's enough.
			} else if (error.name == "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") {
				// constraints cannot be satisfied by available devices
				// NOTE: handled above
				errorMessage.textContent = `Webcam does not support the required resolution. Please change your settings.`;
			} else if (error.name == "NotAllowedError" || error.name == "PermissionDeniedError") {
				// permission denied in browser
				errorMessage.textContent = "Permission denied. Please enable access to the camera.";
			} else if (error.name == "TypeError") {
				// empty constraints object
				errorMessage.textContent = `Something went wrong accessing the camera. (${error.name}: ${error.message})`;
			} else {
				// other errors
				errorMessage.textContent = `Something went wrong accessing the camera. Please try again. (${error.name}: ${error.message})`;
			}
			errorMessage.textContent = `⚠️ ${errorMessage.textContent}`;
			errorMessage.hidden = false;
		});
	};
	useDemoFootageButton.onclick = TrackyMouse.useDemoFootage = () => {
		reset();
		cameraVideo.src = `${TrackyMouse.dependenciesRoot}/private/demo-input-footage.webm`;
		cameraVideo.loop = true;
	};

	startStopButton.onclick = () => {
		if (!useCameraButton.hidden) {
			TrackyMouse.useCamera();
		}
		handleShortcut("toggle-tracking");
	};

	if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
		console.log('getUserMedia not supported in this browser');
	}

	canvasContainer.style.aspectRatio = `${defaultWidth} / ${defaultHeight}`;
	canvasContainer.style.setProperty('--aspect-ratio', defaultWidth / defaultHeight);

	cameraVideo.addEventListener('loadedmetadata', () => {
		cameraVideo.play();
		cameraVideo.width = cameraVideo.videoWidth;
		cameraVideo.height = cameraVideo.videoHeight;
		canvas.width = cameraVideo.videoWidth;
		canvas.height = cameraVideo.videoHeight;
		debugPointsCanvas.width = cameraVideo.videoWidth;
		debugPointsCanvas.height = cameraVideo.videoHeight;

		// .tracky-mouse-canvas-container needs aspect-ratio CSS property
		// so that the video can be scaled to fit the container.
		canvasContainer.style.aspectRatio = `${cameraVideo.videoWidth} / ${cameraVideo.videoHeight}`;
		canvasContainer.style.setProperty('--aspect-ratio', cameraVideo.videoWidth / cameraVideo.videoHeight);

		pointTracker = new OOPS();
	});
	cameraVideo.addEventListener('play', () => {
		clmTracker.reset();
		clmTracker.initFaceDetector(cameraVideo);
		clmTrackingStarted = true;
	});
	cameraVideo.addEventListener('ended', () => {
		useCameraButton.hidden = false;
		if (!paused) {
			handleShortcut("toggle-tracking");
		}
	});
	cameraVideo.addEventListener('error', () => {
		useCameraButton.hidden = false;
		if (!paused) {
			handleShortcut("toggle-tracking");
		}
	});

	canvas.width = defaultWidth;
	canvas.height = defaultHeight;
	cameraVideo.width = defaultWidth;
	cameraVideo.height = defaultHeight;

	const debugPointsCanvas = document.createElement("canvas");
	debugPointsCanvas.width = canvas.width;
	debugPointsCanvas.height = canvas.height;
	const debugPointsCtx = debugPointsCanvas.getContext("2d");

	// function getPyramidData(pyramid) {
	// 	const array = new Float32Array(pyramid.data.reduce((sum, matrix)=> sum + matrix.buffer.f32.length, 0));
	// 	let offset = 0;
	// 	for (const matrix of pyramid.data) {
	// 		copy matrix.buffer.f32 into array starting at offset;
	// 		offset += matrix.buffer.f32.length;
	// 	}
	// 	return array;
	// }
	// function setPyramidData(pyramid, array) {
	// 	let offset = 0;
	// 	for (const matrix of pyramid.data) {
	// 		copy portion of array starting at offset into matrix.buffer.f32
	// 		offset += matrix.buffer.f32.length;
	// 	}
	// }

	// Object Oriented Programming Sucks
	// or Optical flOw Points System
	class OOPS {
		constructor() {
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
			if (this.pointCount < maxPoints) {
				var pointIndex = this.pointCount * 2;
				this.curXY[pointIndex] = x;
				this.curXY[pointIndex + 1] = y;
				this.prevXY[pointIndex] = x;
				this.prevXY[pointIndex + 1] = y;
				this.pointCount++;
			}
		}
		filterPoints(condition) {
			var outputPointIndex = 0;
			for (var inputPointIndex = 0; inputPointIndex < this.pointCount; inputPointIndex++) {
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
					debugPointsCtx.fillStyle = "red";
					const inputOffset = inputPointIndex * 2;
					circle(debugPointsCtx, this.curXY[inputOffset], this.curXY[inputOffset + 1], 5);
					debugPointsCtx.fillText(condition.toString(), 5 + this.curXY[inputOffset], this.curXY[inputOffset + 1]);
					// console.log(this.curXY[inputOffset], this.curXY[inputOffset + 1]);
					ctx.strokeStyle = ctx.fillStyle;
					ctx.beginPath();
					ctx.moveTo(this.prevXY[inputOffset], this.prevXY[inputOffset + 1]);
					ctx.lineTo(this.curXY[inputOffset], this.curXY[inputOffset + 1]);
					ctx.stroke();
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
				grid[`${~~(this.curXY[pointOffset] / pruningGridSize)},${~~(this.curXY[pointOffset + 1] / pruningGridSize)}`] = pointIndex;
			}
			const indexesToKeep = Object.values(grid);
			this.filterPoints((pointIndex) => indexesToKeep.includes(pointIndex));
		}
		update(imageData) {
			[this.prevXY, this.curXY] = [this.curXY, this.prevXY];
			[this.prevPyramid, this.curPyramid] = [this.curPyramid, this.prevPyramid];

			// these are options worth breaking out and exploring
			var winSize = 20;
			var maxIterations = 30;
			var epsilon = 0.01;
			var minEigen = 0.001;

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
			for (var i = 0; i < this.pointCount; i++) {
				var pointOffset = i * 2;
				// var distMoved = Math.hypot(
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
			var movementX = 0;
			var movementY = 0;
			var numMovements = 0;
			for (var i = 0; i < this.pointCount; i++) {
				var pointOffset = i * 2;
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

	// FIXME: can't click to add points because canvas is covered by .tracky-mouse-canvas-overlay
	canvas.addEventListener('click', (event) => {
		if (!pointTracker) {
			return;
		}
		const rect = canvas.getBoundingClientRect();
		if (s.mirror) {
			pointTracker.addPoint(
				(rect.right - event.clientX) / rect.width * canvas.width,
				(event.clientY - rect.top) / rect.height * canvas.height,
			);
		} else {
			pointTracker.addPoint(
				(event.clientX - rect.left) / rect.width * canvas.width,
				(event.clientY - rect.top) / rect.height * canvas.height,
			);
		}
	});

	function maybeAddPoint(oops, x, y) {
		// In order to prefer points that already exist, since they're already tracking,
		// in order to keep a smooth overall tracking calculation,
		// don't add points if they're close to an existing point.
		// Otherwise, it would not just be redundant, but often remove the older points, in the pruning.
		for (var pointIndex = 0; pointIndex < oops.pointCount; pointIndex++) {
			var pointOffset = pointIndex * 2;
			// var distance = Math.hypot(
			// 	x - oops.curXY[pointOffset],
			// 	y - oops.curXY[pointOffset + 1]
			// );
			// if (distance < 8) {
			// 	return;
			// }
			// It might be good to base this on the size of the face...
			// Also, since we're pruning points based on a grid,
			// there's not much point in using Euclidean distance here,
			// we can just look at x and y distances.
			if (
				Math.abs(x - oops.curXY[pointOffset]) <= minDistanceToAddPoint ||
				Math.abs(y - oops.curXY[pointOffset + 1]) <= minDistanceToAddPoint
			) {
				return;
			}
		}
		oops.addPoint(x, y);
	}

	/** Returns the distance between a point and a line defined by two points, with the sign indicating which side of the line the point is on */
	function signedDistancePointLine(point, a, b) {
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

	function draw(update = true) {
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
						pointTracker.filterPoints((pointIndex) => {
							var pointOffset = pointIndex * 2;
							// distance from tip of nose (stretched so make an ellipse taller than wide)
							var distance = Math.hypot(
								(annotations.noseTip[0][0] - pointTracker.curXY[pointOffset]) * 1.4,
								annotations.noseTip[0][1] - pointTracker.curXY[pointOffset + 1]
							);
							var headSize = Math.hypot(
								annotations.leftCheek[0][0] - annotations.rightCheek[0][0],
								annotations.leftCheek[0][1] - annotations.rightCheek[0][1]
							);
							if (distance > headSize) {
								return false;
							}
							// Avoid blinking eyes affecting pointer position.
							// distance to outer corners of eyes
							distance = Math.min(
								Math.hypot(
									annotations.leftEyeLower0[0][0] - pointTracker.curXY[pointOffset],
									annotations.leftEyeLower0[0][1] - pointTracker.curXY[pointOffset + 1]
								),
								Math.hypot(
									annotations.rightEyeLower0[0][0] - pointTracker.curXY[pointOffset],
									annotations.rightEyeLower0[0][1] - pointTracker.curXY[pointOffset + 1]
								),
							);
							if (distance < headSize * 0.42) {
								return false;
							}
							return true;
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

						// TODO: move facial gesture recognition code to a separate file
						function detectBlinks() {
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

						function detectMouthOpen() {
							const prevThresholdMet = mouthInfo?.thresholdMet;
							const mouth = getAspectMetrics(annotations.lipsUpperInner, annotations.lipsLowerInner);
							const thresholdHigh = 0.25;
							const thresholdLow = 0.15;
							mouth.thresholdMet = mouth.heightRatio > (prevThresholdMet ? thresholdLow : thresholdHigh);
							mouth.active = mouth.thresholdMet; // TODO: maybe default to false, have this only set externally in gesture handling code
							return mouth;
						}

						const prevMouthOpen = mouthInfo?.thresholdMet;

						blinkInfo = detectBlinks();
						mouthInfo = detectMouthOpen();
						if (blinkInfo.rightEye.open || blinkInfo.leftEye.open) {
							lastTimeWhenAnEyeWasOpen = performance.now();
						}
						if (performance.now() - lastTimeWhenAnEyeWasOpen > 2000) {
							if (s.closeEyesToToggle) {
								paused = !paused;
								updatePaused();
								// TODO: handle edge cases
								// TODO: try to keep variable names meaningful
								lastTimeWhenAnEyeWasOpen = Infinity;
							}
						}

						blinkInfo.used = false;
						mouthInfo.used = false;
						let clickButton = -1;
						if (s.clickingMode === "blink") {
							blinkInfo.used = true;
							if (blinkInfo.rightEye.active) {
								clickButton = 0;
							} else if (blinkInfo.leftEye.active) {
								clickButton = 2;
							}
						}
						// TODO: maybe split into a "simple"/mouth-only mode vs "with eye modifiers" mode?
						// (or just hold out for a full I/O binding system)
						if (s.clickingMode === "open-mouth") {
							mouthInfo.used = true;
							blinkInfo.used = true;
							// Modifiers with eye closing trigger different buttons,
							// making this a three-button mouse.
							// (Eyebrow raising could be another alternative modifier.)
							// Keep same button held if eye is opened,
							// so you can continue to scroll a webpage without trying to
							// read with one eye closed (for example).
							if (mouthInfo.thresholdMet && !prevMouthOpen) {
								if (blinkInfo.rightEye.active) {
									mouseButtonUntilMouthCloses = 1;
								} else if (blinkInfo.leftEye.active) {
									mouseButtonUntilMouthCloses = 2;
								} else if (!blinkInfo.rightEye.open && !blinkInfo.leftEye.open) {
									mouseButtonUntilMouthCloses = -1;
								} else {
									mouseButtonUntilMouthCloses = 0;
								}
							}
							if (mouthInfo.thresholdMet) {
								clickButton = mouseButtonUntilMouthCloses;
								if (clickButton === -1) {
									// Show as passive / not clicking in visuals
									mouthInfo.active = false;
									// TODO: show eyes as yellow too regardless of eye state?
								}
								// TODO: DRY mapping
								blinkInfo.rightEye.active = clickButton === 1;
								blinkInfo.leftEye.active = clickButton === 2;
							}
						}

						// TODO: implement these clicking modes for the web library version
						// and unhide the "Clicking mode" setting in the UI
						// https://github.com/1j01/tracky-mouse/issues/72
						const buttonNames = ["left", "middle", "right"];
						for (let buttonIndex = 0; buttonIndex < 3; buttonIndex++) {
							if ((clickButton === buttonIndex) !== buttonStates[buttonNames[buttonIndex]]) {
								window.electronAPI?.setMouseButtonState(buttonIndex, clickButton === buttonIndex);
								buttonStates[buttonNames[buttonIndex]] = clickButton === buttonIndex;
								if ((clickButton === buttonIndex)) {
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

		if (window.electronAPI) {
			window.electronAPI.updateInputFeedback({
				headNotFound: !face && !facemeshPrediction,
				blinkInfo,
				mouthInfo,
			});
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
			} else {
				if (update && useFacemesh) {
					pointsBasedOnFaceInViewConfidence -= 0.001;
				}
			}

			const keypoints = facemeshPrediction.keypoints;
			if (showDebugHeadTilt && keypoints) {
				const { top, bottom, left, right } = headTilt.keypoints;
				const nose = keypoints[1];

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


					const pitchText = `Pitch: ${(headTilt.pitch * 180 / Math.PI).toFixed(1)}°`;
					const yawText = `Yaw:   ${(headTilt.yaw * 180 / Math.PI).toFixed(1)}°`;
					const rollText = `Roll:  ${(headTilt.roll * 180 / Math.PI).toFixed(1)}°`;

					const boxWidth = Math.max(
						ctx.measureText(pitchText).width,
						ctx.measureText(yawText).width,
						ctx.measureText(rollText).width
					);
					const boxHeight = textLineHeight * 3;
					const padding = 10;

					// Calculate screen coordinates for the text box
					let screenX = s.mirror ? canvas.width - cx : cx;
					let screenY = cy;

					// Nominal position relative to head center
					let textScreenX = screenX + textX;
					let textScreenY = screenY + textYStart;

					// Clamp to canvas bounds
					textScreenX = Math.max(padding, Math.min(canvas.width - boxWidth - padding, textScreenX));
					textScreenY = Math.max(textLineHeight, Math.min(canvas.height - boxHeight + textLineHeight, textScreenY));

					ctx.save();
					if (s.mirror) {
						ctx.scale(-1, 1);
					}

					const screenNoseX = s.mirror ? canvas.width - cx : cx;
					const screenNoseY = cy;

					const dx = textScreenX - screenNoseX;
					const dy = textScreenY - screenNoseY;

					ctx.strokeText(pitchText, dx, dy);
					ctx.fillText(pitchText, dx, dy);
					ctx.strokeText(yawText, dx, dy + textLineHeight);
					ctx.fillText(yawText, dx, dy + textLineHeight);
					ctx.strokeText(rollText, dx, dy + textLineHeight * 2);
					ctx.fillText(rollText, dx, dy + textLineHeight * 2);

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
		}

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
						var pointOffset = pointIndex * 2;
						// distance from tip of nose (stretched so make an ellipse taller than wide)
						var distance = Math.hypot(
							(face[62][0] - pointTracker.curXY[pointOffset]) * 1.4,
							face[62][1] - pointTracker.curXY[pointOffset + 1]
						);
						// distance based on outer eye corners
						var headSize = Math.hypot(
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
			if (showClmTracking) {
				clmTracker.draw(canvas, undefined, undefined, true);
			}
		}
		ctx.fillStyle = "lime";
		pointTracker.draw(ctx);
		debugPointsCtx.fillStyle = "green";
		pointTracker.draw(debugPointsCtx);

		if (update) {
			const screenWidth = window.electronAPI ? screen.width : innerWidth;
			const screenHeight = window.electronAPI ? screen.height : innerHeight;

			var [movementX, movementY] = pointTracker.getMovement();

			// Acceleration curves add a lot of stability,
			// letting you focus on a specific point without jitter, but still move quickly.

			// var accelerate = (delta, distance) => (delta / 10) * (distance ** 0.8);
			// var accelerate = (delta, distance) => (delta / 1) * (Math.abs(delta) ** 0.8);
			var accelerate = (delta, _distance) => (delta / 1) * (Math.abs(delta * 5) ** s.headTrackingAcceleration);

			var distance = Math.hypot(movementX, movementY);
			var deltaX = accelerate(movementX * s.headTrackingSensitivityX, distance);
			var deltaY = accelerate(movementY * s.headTrackingSensitivityY, distance);

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

			// This should never happen
			if (!isFinite(deltaX) || !isFinite(deltaY)) {
				return;
			}

			if (!paused) {
				mouseX -= deltaX * screenWidth;
				mouseY += deltaY * screenHeight;

				mouseX = Math.min(Math.max(0, mouseX), screenWidth);
				mouseY = Math.min(Math.max(0, mouseY), screenHeight);

				if (mouseNeedsInitPos) {
					// TODO: option to get preexisting mouse position instead of set it to center of screen
					mouseX = screenWidth / 2;
					mouseY = screenHeight / 2;
					mouseNeedsInitPos = false;
				}
				if (window.electronAPI) {
					window.electronAPI.moveMouse(~~mouseX, ~~mouseY);
					pointerEl.style.display = "none";
				} else {
					pointerEl.style.display = "";
					pointerEl.style.left = `${mouseX}px`;
					pointerEl.style.top = `${mouseY}px`;
				}
				if (TrackyMouse.onPointerMove) {
					TrackyMouse.onPointerMove(mouseX, mouseY);
				}
			}
		}
		ctx.restore();

		if (showDebugText) {
			ctx.save();
			ctx.fillStyle = "#fff";
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 3;
			ctx.font = "20px sans-serif";
			ctx.beginPath();
			const text3 = "Face convergence score: " + ((useFacemesh && facemeshPrediction) ? "N/A" : faceConvergence.toFixed(4));
			const text1 = "Face tracking score: " + ((useFacemesh && facemeshPrediction) ? facemeshPrediction.faceInViewConfidence : faceScore).toFixed(4);
			const text2 = "Points based on score: " + ((useFacemesh && facemeshPrediction) ? pointsBasedOnFaceInViewConfidence : pointsBasedOnFaceScore).toFixed(4);
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
		stats?.update();
	}

	function circle(ctx, x, y, r) {
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}

	// Can't use requestAnimationFrame, doesn't work with webPreferences.backgroundThrottling: false (at least in some version of Electron (v12 I think, when I tested it), on Ubuntu, with XFCE)
	setInterval(function animationLoop() {
		draw(!paused || document.visibilityState === "visible");
	}, 15);

	let autoDemo = false;
	try {
		autoDemo = localStorage.trackyMouseAutoDemo === "true";
	} catch (_error) {
		// ignore; this is just for development
	}
	if (autoDemo) {
		TrackyMouse.useDemoFootage();
	} else if (window.electronAPI) {
		TrackyMouse.useCamera();
	}

	const updateStartStopButton = () => {
		if (paused) {
			startStopButton.textContent = "Start";
			startStopButton.setAttribute("aria-pressed", "false");
		} else {
			startStopButton.textContent = "Stop";
			startStopButton.setAttribute("aria-pressed", "true");
		}
	};
	const updatePaused = () => {
		mouseNeedsInitPos = true;
		if (paused) {
			pointerEl.style.display = "none";
		}
		updateStartStopButton();
		if (window.electronAPI) {
			window.electronAPI.notifyToggleState(!paused);
		}
	};
	const handleShortcut = (shortcutType) => {
		if (shortcutType === "toggle-tracking") {
			paused = !paused;
			updatePaused();
		}
	};
	settingsLoadedPromise.then(updatePaused);

	// Try to handle both the global and local shortcuts
	// If the global shortcut successfully registered, keydown shouldn't occur for the shortcut, right?
	// I hope there's no cross-platform issue with this.
	if (window.electronAPI) {
		window.electronAPI.onShortcut(handleShortcut);
	}
	const handleKeydown = (event) => {
		// Same shortcut as the global shortcut in the electron app
		if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "F9") {
			handleShortcut("toggle-tracking");
		}
	};
	addEventListener("keydown", handleKeydown);

	return {
		dispose() {
			// TODO: re-structure so that cleanup can succeed even if initialization fails
			// OOP would help with this, by storing references in an object, but it doesn't necessarily
			// need to be converted to a class, it could just be an object, with a try-finally used for returning the API with a `dispose` method.
			// Wouldn't need to change the API that way.
			// (Would also be easy to maintain backwards compatibility while switching to using a class,
			// returning an instance of the class from `TrackyMouse.init` but deprecating it in favor of constructing the class.)

			// stopping camera stream is important, not sure about other resetting
			reset();

			// just in case there's any async code looking at whether it's paused
			paused = true;

			if (detector) {
				detector.dispose();
				detector = null;
			}
			if (clmTracker) {
				// not sure this helps clean up any resources
				clmTracker.reset();
			}

			pointerEl.remove();

			stats?.domElement.remove(); // there is no dispose method but this may be all that it would need to do https://github.com/mrdoob/stats.js/pull/96

			removeEventListener("keydown", handleKeydown);

			// This is a little awkward, reversing the initialization based on a possibly-preexisting element
			// Could save and restore innerHTML but that won't restore event listeners, references, etc.
			// and may not even be desired if the HTML was placeholder text mentioning it not yet being initialized for example.
			uiContainer.classList.remove("tracky-mouse-ui");
			uiContainer.innerHTML = "";
			if (!div) {
				uiContainer.remove();
			}
		},
	};
};

// CommonJS export is untested. Script tag usage recommended.
// Just including this in case it is somehow useful.
// eslint-disable-next-line no-undef
if (typeof module !== "undefined" && module.exports) {
	// eslint-disable-next-line no-undef
	module.exports = TrackyMouse;
}
