import { playSound } from "./audio.js";
import { averagePoints, isSelectorValid } from "./helpers.js";

export const dwellClickers = [];

/**
 * @param {Object} config
 * @param {string} config.targets - a CSS selector for the elements to click. Anything else will be ignored (except as an occluder).
 * @param {(el: Element) => boolean} [config.shouldDrag] - a function that returns true if the element should be dragged rather than simply clicked.
 * @param {(el: Element) => boolean} [config.noCenter] - a function that returns true if the element should be clicked anywhere on the element, rather than always at the center.
 * @param {Array<{
 *   from: string | Element | ((el: Element) => boolean), // - an array of `{ from, to, withinMargin }` objects, which define rules for dynamically changing what is hovered/clicked when the mouse is over a different element.
 *   to: string | Element | ((el: Element) => Element | null), // - the element to retarget from. Can be a CSS selector, an element, or a function taking the element under the mouse and returning whether it should be retargeted.
 *   withinMargin?: number // - the element to retarget to. Can be a CSS selector for an element which is an ancestor or descendant of the `from` element, or an element, or a function taking the element under the mouse and returning an element to retarget to, or null to ignore the element.
 * }>} [config.retarget] - a number of pixels within which to consider the mouse over the `to` element. Default to infinity.
 * @param {(el1: Element, el2: Element) => boolean} [config.isEquivalentTarget] - a function that returns true if two elements should be considered part of the same control, i.e. if clicking either should do the same thing. Elements that are equal are always considered equivalent even if you return false. This option is used for preventing the system from detecting occluding elements as separate controls, and rejecting the click. (When an occlusion is detected, it flashes a red box.)
 * @param {(el: Element) => boolean} [config.dwellClickEvenIfPaused] - a function that returns true if the element should be clicked even while dwell clicking is otherwise paused. Use this for a dwell clicking toggle button, so it's possible to resume dwell clicking. With dwell clicking it's important to let users take a break, since otherwise you have to constantly move the cursor in order to not click on things!
 * @param {(el: Element) => boolean} [config.shouldClickThrough] - a function that returns true if the element should be totally ignored, allowing clicking on content behind it. Prefer `pointer-events: none` when possible, which will work for all input methods. Use this only if you need to differentiate input methods. Default: `(el) => el.matches(".tracky-mouse-click-through, .tracky-mouse-click-through *")`
 * @param {(args: {x: number, y: number, target: Element}) => void} config.click - a function to trigger a click on the given target element.
 * @param {() => void} [config.beforeDispatch] - a function to call before a pointer event is dispatched. For detecting un-trusted user gestures, outside of an event handler.
 * @param {() => void} [config.afterDispatch] - a function to call after a pointer event is dispatched. For detecting un-trusted user gestures, outside of an event handler.
 * @param {() => void} [config.beforePointerDownDispatch] - a function to call before a `pointerdown` event is dispatched. Likely to be merged with `config.beforeDispatch()` in the future.
 * @param {() => boolean} [config.isHeld] - a function that returns true if the next dwell should be a release (triggering `pointerup`).
 */
export function initDwellClicking(config) {

	/** translation placeholder */
	const t = (key, options = {}) => options.defaultValue ?? key;

	if (typeof config !== "object") {
		throw new Error(t("api.errors.configRequired", { defaultValue: "configuration object required for initDwellClicking" }));
	}
	if (config.targets === undefined) {
		throw new Error(t("api.errors.targetsRequired", { defaultValue: "config.targets is required (must be a CSS selector)" }));
	}
	if (typeof config.targets !== "string") {
		throw new Error(t("api.errors.targetsMustBeSelectorString", { defaultValue: "config.targets must be a string (a CSS selector)" }));
	}
	if (!isSelectorValid(config.targets)) {
		throw new Error(t("api.errors.targetsInvalidSelector", { defaultValue: "config.targets is not a valid CSS selector" }));
	}
	if (config.click === undefined) {
		throw new Error(t("api.errors.clickRequired", { defaultValue: "config.click is required" }));
	}
	if (typeof config.click !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.click"));
	}
	if (config.shouldDrag !== undefined && typeof config.shouldDrag !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.shouldDrag"));
	}
	if (config.noCenter !== undefined && typeof config.noCenter !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.noCenter"));
	}
	if (config.isEquivalentTarget !== undefined && typeof config.isEquivalentTarget !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.isEquivalentTarget"));
	}
	if (config.dwellClickEvenIfPaused !== undefined && typeof config.dwellClickEvenIfPaused !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.dwellClickEvenIfPaused"));
	}
	if (config.shouldClickThrough !== undefined && typeof config.shouldClickThrough !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.shouldClickThrough"));
	}
	if (config.beforeDispatch !== undefined && typeof config.beforeDispatch !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.beforeDispatch"));
	}
	if (config.afterDispatch !== undefined && typeof config.afterDispatch !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.afterDispatch"));
	}
	if (config.beforePointerDownDispatch !== undefined && typeof config.beforePointerDownDispatch !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.beforePointerDownDispatch"));
	}
	if (config.isHeld !== undefined && typeof config.isHeld !== "function") {
		throw new Error(t("api.errors.functionRequired", { defaultValue: "%0 must be a function" }).replace("%0", "config.isHeld"));
	}
	if (config.retarget !== undefined) {
		if (!Array.isArray(config.retarget)) {
			throw new Error(t("api.errors.retargetMustBeArray", { defaultValue: "config.retarget must be an array of objects" }));
		}
		for (let i = 0; i < config.retarget.length; i++) {
			const rule = config.retarget[i];
			if (typeof rule !== "object") {
				throw new Error(t("api.errors.retargetMustBeArray", { defaultValue: "config.retarget must be an array of objects" }));
			}
			if (rule.from === undefined) {
				throw new Error(t("api.errors.retargetFromRequired", { defaultValue: "config.retarget[%0].from is required" }).replace("%0", i));
			}
			if (rule.to === undefined) {
				throw new Error(t("api.errors.retargetToRequired", { defaultValue: "config.retarget[%0].to is required (although can be null to ignore the element)" }).replace("%0", i));
			}
			if (rule.withinMargin !== undefined && typeof rule.withinMargin !== "number") {
				throw new Error(t("api.errors.numberRequired", { defaultValue: "%0 must be a number" }).replace("%0", `config.retarget[${i}].withinMargin`));
			}
			if (typeof rule.from !== "string" && typeof rule.from !== "function" && !(rule.from instanceof Element)) {
				throw new Error(t("api.errors.retargetFromInvalidType", { defaultValue: "config.retarget[%0].from must be a CSS selector string, an Element, or a function" }).replace("%0", i));
			}
			if (typeof rule.to !== "string" && typeof rule.to !== "function" && !(rule.to instanceof Element) && rule.to !== null) {
				throw new Error(t("api.errors.retargetToInvalidType", { defaultValue: "config.retarget[%0].to must be a CSS selector string, an Element, a function, or null" }).replace("%0", i));
			}
			if (typeof rule.from === "string" && !isSelectorValid(rule.from)) {
				throw new Error(t("api.errors.retargetFromInvalidSelector", { defaultValue: "config.retarget[%0].from is not a valid CSS selector" }).replace("%0", i));
			}
			if (typeof rule.to === "string" && !isSelectorValid(rule.to)) {
				throw new Error(t("api.errors.retargetToInvalidSelector", { defaultValue: "config.retarget[%0].to is not a valid CSS selector" }).replace("%0", i));
			}
		}
	}

	const shouldClickThrough = config.shouldClickThrough ?? ((el) => el.matches(".tracky-mouse-click-through, .tracky-mouse-click-through *"));

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

		if (shouldClickThrough(target)) {
			const elements = document.elementsFromPoint(clientX, clientY);
			target = elements.find(el => !shouldClickThrough(el));
			if (!target) {
				return null;
			}
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
					occluderIndicator.className = "tracky-mouse-occluder-indicator";
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
					// TODO: ignore .tracky-mouse-click-through elements here as well
					// TODO: distinguish occlusion vs moved element (i.e. element is no longer in the elementsFromPoint list)
					// for example for the archery targets in the demo on the website, which animate
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
						playSound("clickRelease");
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
							playSound("clickPress");
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
							playSound("clickPress");
							playSound("clickRelease", { delay: 0.03 }); // fully separating the sounds sounded worse
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
