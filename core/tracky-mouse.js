/* global jsfeat, Stats, clm, faceLandmarksDetection */
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
	];
	if (statsJs) {
		scriptFiles.push(`${TrackyMouse.dependenciesRoot}/lib/stats.js`);
	}
	return Promise.all(scriptFiles.map(loadScript));
};

const is_selector_valid = ((dummy_element) =>
	(selector) => {
		try { dummy_element.querySelector(selector); } catch { return false; }
		return true;
	})(document.createDocumentFragment());


const dwell_clickers = [];

const init_dwell_clicking = (config) => {
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
	if (!is_selector_valid(config.targets)) {
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
			if (typeof rule.from === "string" && !is_selector_valid(rule.from)) {
				throw new Error(`config.retarget[${i}].from is not a valid CSS selector`);
			}
			if (typeof rule.to === "string" && !is_selector_valid(rule.to)) {
				throw new Error(`config.retarget[${i}].to is not a valid CSS selector`);
			}
		}
	}

	// tracky_mouse_container.querySelector(".tracky-mouse-canvas").classList.add("inset-deep");

	const circle_radius_max = 50; // dwell indicator size in pixels
	const hover_timespan = 500; // how long between the dwell indicator appearing and triggering a click
	const averaging_window_timespan = 500;
	const inactive_at_startup_timespan = 1500; // (should be at least averaging_window_timespan, but more importantly enough to make it not awkward when enabling dwell clicking)
	const inactive_after_release_timespan = 1000; // after click or drag release (from dwell or otherwise)
	const inactive_after_hovered_timespan = 1000; // after dwell click indicator appears; does not control the time to finish that dwell click, only to click on something else after this is canceled (but it doesn't control that directly)
	const inactive_after_invalid_timespan = 1000; // after a dwell click is canceled due to an element popping up in front, or existing in front at the center of the other element
	const inactive_after_focused_timespan = 1000; // after page becomes focused after being unfocused
	let recent_points = [];
	let inactive_until_time = performance.now();
	let paused = false;
	let hover_candidate;
	let dwell_dragging = null;

	const deactivate_for_at_least = (timespan) => {
		inactive_until_time = Math.max(inactive_until_time, performance.now() + timespan);
	};
	deactivate_for_at_least(inactive_at_startup_timespan);

	const halo = document.createElement("div");
	halo.className = "tracky-mouse-hover-halo";
	halo.style.display = "none";
	document.body.appendChild(halo);
	const dwell_indicator = document.createElement("div");
	dwell_indicator.className = "tracky-mouse-dwell-indicator";
	dwell_indicator.style.width = `${circle_radius_max}px`;
	dwell_indicator.style.height = `${circle_radius_max}px`;
	dwell_indicator.style.display = "none";
	document.body.appendChild(dwell_indicator);

	const on_pointer_move = (e) => {
		recent_points.push({ x: e.clientX, y: e.clientY, time: performance.now() });
	};
	const on_pointer_up_or_cancel = (_e) => {
		deactivate_for_at_least(inactive_after_release_timespan);
		dwell_dragging = null;
	};

	let page_focused = document.visibilityState === "visible"; // guess/assumption
	let mouse_inside_page = true; // assumption
	const on_focus = () => {
		page_focused = true;
		deactivate_for_at_least(inactive_after_focused_timespan);
	};
	const on_blur = () => {
		page_focused = false;
	};
	const on_mouse_leave_page = () => {
		mouse_inside_page = false;
	};
	const on_mouse_enter_page = () => {
		mouse_inside_page = true;
	};

	window.addEventListener("pointermove", on_pointer_move);
	window.addEventListener("pointerup", on_pointer_up_or_cancel);
	window.addEventListener("pointercancel", on_pointer_up_or_cancel);
	window.addEventListener("focus", on_focus);
	window.addEventListener("blur", on_blur);
	document.addEventListener("mouseleave", on_mouse_leave_page);
	document.addEventListener("mouseenter", on_mouse_enter_page);

	const get_hover_candidate = (clientX, clientY) => {

		if (!page_focused || !mouse_inside_page) return null;

		let target = document.elementFromPoint(clientX, clientY);
		if (!target) {
			return null;
		}

		let hover_candidate = {
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
				const to_element =
					(to instanceof Element || to === null) ? to :
						typeof to === "function" ? to(target) :
							(target.closest(to) || target.querySelector(to));
				if (to_element === null) {
					return null;
				} else if (to_element) {
					const to_rect = to_element.getBoundingClientRect();
					if (
						hover_candidate.x > to_rect.left - withinMargin &&
						hover_candidate.y > to_rect.top - withinMargin &&
						hover_candidate.x < to_rect.right + withinMargin &&
						hover_candidate.y < to_rect.bottom + withinMargin
					) {
						target = to_element;
						hover_candidate.x = Math.min(
							to_rect.right - 1,
							Math.max(
								to_rect.left,
								hover_candidate.x,
							),
						);
						hover_candidate.y = Math.min(
							to_rect.bottom - 1,
							Math.max(
								to_rect.top,
								hover_candidate.y,
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
			hover_candidate.x = rect.left + rect.width / 2;
			hover_candidate.y = rect.top + rect.height / 2;
		}
		hover_candidate.target = target;
		return hover_candidate;
	};

	const get_event_options = ({ x, y }) => {
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

	const average_points = (points) => {
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
		recent_points = recent_points.filter((point_record) => time < point_record.time + averaging_window_timespan);
		if (recent_points.length) {
			const latest_point = recent_points[recent_points.length - 1];
			recent_points.push({ x: latest_point.x, y: latest_point.y, time });
			const average_point = average_points(recent_points);
			// debug
			// const canvas_point = to_canvas_coords({clientX: average_point.x, clientY: average_point.y});
			// ctx.fillStyle = "red";
			// ctx.fillRect(canvas_point.x, canvas_point.y, 10, 10);
			const recent_movement_amount = Math.hypot(latest_point.x - average_point.x, latest_point.y - average_point.y);

			// Invalidate in case an element pops up in front of the element you're hovering over, e.g. a submenu
			// (that use case doesn't actually work in jspaint because the menu pops up before the hover_candidate exists)
			// (TODO: disable hovering to open submenus in facial mouse mode in jspaint)
			// or an element occludes the center of an element you're hovering over, in which case it
			// could be confusing if it showed a dwell click indicator over a different element than it would click
			// (but TODO: just move the indicator off center in that case)
			if (hover_candidate && !dwell_dragging) {
				const apparent_hover_candidate = get_hover_candidate(hover_candidate.x, hover_candidate.y);
				const show_occluder_indicator = (occluder) => {
					const occluder_indicator = document.createElement("div");
					const occluder_rect = occluder.getBoundingClientRect();
					const outline_width = 4;
					occluder_indicator.style.pointerEvents = "none";
					occluder_indicator.style.zIndex = 1000001;
					occluder_indicator.style.display = "block";
					occluder_indicator.style.position = "fixed";
					occluder_indicator.style.left = `${occluder_rect.left + outline_width}px`;
					occluder_indicator.style.top = `${occluder_rect.top + outline_width}px`;
					occluder_indicator.style.width = `${occluder_rect.width - outline_width * 2}px`;
					occluder_indicator.style.height = `${occluder_rect.height - outline_width * 2}px`;
					occluder_indicator.style.outline = `${outline_width}px dashed red`;
					occluder_indicator.style.boxShadow = `0 0 ${outline_width}px ${outline_width}px maroon`;
					document.body.appendChild(occluder_indicator);
					setTimeout(() => {
						occluder_indicator.remove();
					}, inactive_after_invalid_timespan * 0.5);
				};
				if (apparent_hover_candidate) {
					if (
						apparent_hover_candidate.target !== hover_candidate.target &&
						// !retargeted &&
						!config.isEquivalentTarget?.(
							apparent_hover_candidate.target, hover_candidate.target
						)
					) {
						hover_candidate = null;
						deactivate_for_at_least(inactive_after_invalid_timespan);
						show_occluder_indicator(apparent_hover_candidate.target);
					}
				} else {
					let occluder = document.elementFromPoint(hover_candidate.x, hover_candidate.y);
					hover_candidate = null;
					deactivate_for_at_least(inactive_after_invalid_timespan);
					show_occluder_indicator(occluder || document.body);
				}
			}

			let circle_position = latest_point;
			let circle_opacity = 0;
			let circle_radius = 0;
			if (hover_candidate) {
				circle_position = hover_candidate;
				circle_opacity = 0.4;
				circle_radius =
					(hover_candidate.time - time + hover_timespan) / hover_timespan
					* circle_radius_max;
				if (time > hover_candidate.time + hover_timespan) {
					if (config.isHeld?.() || dwell_dragging) {
						config.beforeDispatch?.();
						hover_candidate.target.dispatchEvent(new PointerEvent("pointerup",
							Object.assign(get_event_options(hover_candidate), {
								button: 0,
								buttons: 0,
							})
						));
						config.afterDispatch?.();
					} else {
						config.beforePointerDownDispatch?.();
						config.beforeDispatch?.();
						hover_candidate.target.dispatchEvent(new PointerEvent("pointerdown",
							Object.assign(get_event_options(hover_candidate), {
								button: 0,
								buttons: 1,
							})
						));
						config.afterDispatch?.();
						if (config.shouldDrag?.(hover_candidate.target)) {
							dwell_dragging = hover_candidate.target;
						} else {
							config.beforeDispatch?.();
							hover_candidate.target.dispatchEvent(new PointerEvent("pointerup",
								Object.assign(get_event_options(hover_candidate), {
									button: 0,
									buttons: 0,
								})
							));
							config.click(hover_candidate);
							config.afterDispatch?.();
						}
					}
					hover_candidate = null;
					deactivate_for_at_least(inactive_after_hovered_timespan);
				}
			}

			if (dwell_dragging) {
				dwell_indicator.classList.add("tracky-mouse-for-release");
			} else {
				dwell_indicator.classList.remove("tracky-mouse-for-release");
			}
			dwell_indicator.style.display = "";
			dwell_indicator.style.opacity = circle_opacity;
			dwell_indicator.style.transform = `scale(${circle_radius / circle_radius_max})`;
			dwell_indicator.style.left = `${circle_position.x - circle_radius_max / 2}px`;
			dwell_indicator.style.top = `${circle_position.y - circle_radius_max / 2}px`;

			let halo_target =
				dwell_dragging ||
				(hover_candidate || get_hover_candidate(latest_point.x, latest_point.y) || {}).target;

			if (halo_target && (!paused || config.dwellClickEvenIfPaused?.(halo_target))) {
				let rect = halo_target.getBoundingClientRect();
				const computed_style = getComputedStyle(halo_target);
				let ancestor = halo_target;
				let border_radius_scale = 1; // for border radius mimicry, given parents with transform: scale()
				while (ancestor instanceof HTMLElement) {
					const ancestor_computed_style = getComputedStyle(ancestor);
					if (ancestor_computed_style.transform) {
						// Collect scale transforms
						const match = ancestor_computed_style.transform.match(/(?:scale|matrix)\((\d+(?:\.\d+)?)/);
						if (match) {
							border_radius_scale *= Number(match[1]);
						}
					}
					if (ancestor_computed_style.overflow !== "visible") {
						// Clamp to visible region if in scrollable area
						// This lets you see the hover halo when scrolled to the middle of a large canvas
						const scroll_area_rect = ancestor.getBoundingClientRect();
						rect = {
							left: Math.max(rect.left, scroll_area_rect.left),
							top: Math.max(rect.top, scroll_area_rect.top),
							right: Math.min(rect.right, scroll_area_rect.right),
							bottom: Math.min(rect.bottom, scroll_area_rect.bottom),
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
					if (computed_style[prop].endsWith("px")) {
						halo.style[prop] = `${parseFloat(computed_style[prop]) * border_radius_scale}px`;
					} else {
						halo.style[prop] = computed_style[prop];
					}
				}
			} else {
				halo.style.display = "none";
			}

			if (time < inactive_until_time) {
				return;
			}
			if (recent_movement_amount < 5) {
				if (!hover_candidate) {
					hover_candidate = {
						x: average_point.x,
						y: average_point.y,
						time: performance.now(),
						target: dwell_dragging || null,
					};
					if (!dwell_dragging) {
						hover_candidate = get_hover_candidate(hover_candidate.x, hover_candidate.y);
					}
					if (hover_candidate && (paused && !config.dwellClickEvenIfPaused?.(hover_candidate.target))) {
						hover_candidate = null;
					}
				}
			}
			if (recent_movement_amount > 100) {
				if (dwell_dragging) {
					config.beforeDispatch?.();
					window.dispatchEvent(new PointerEvent("pointerup",
						Object.assign(get_event_options(average_point), {
							button: 0,
							buttons: 0,
						})
					));
					config.afterDispatch?.();
					config.afterReleaseDrag?.();
				}
			}
			if (recent_movement_amount > 60) {
				hover_candidate = null;
			}
		}
	};
	let raf_id;
	const animate = () => {
		raf_id = requestAnimationFrame(animate);
		update();
	};
	raf_id = requestAnimationFrame(animate);

	const dispose = () => {
		cancelAnimationFrame(raf_id);
		halo.remove();
		dwell_indicator.remove();
		window.removeEventListener("pointermove", on_pointer_move);
		window.removeEventListener("pointerup", on_pointer_up_or_cancel);
		window.removeEventListener("pointercancel", on_pointer_up_or_cancel);
		window.removeEventListener("focus", on_focus);
		window.removeEventListener("blur", on_blur);
		document.removeEventListener("mouseleave", on_mouse_leave_page);
		document.removeEventListener("mouseenter", on_mouse_enter_page);
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
	dwell_clickers.push(dwellClicker);
	return dwellClicker;
};

TrackyMouse.initDwellClicking = function (config) {
	return init_dwell_clicking(config);
};
TrackyMouse.cleanupDwellClicking = function () {
	for (const dwell_clicker of dwell_clickers) {
		dwell_clicker.dispose();
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
	// Note: Don't use `... in settings.globalSettings` to check if a setting is defined.
	// We must ignore `undefined` values so that the defaults carry over from the renderer to the main process in the Electron app.
	// TODO: make setting definitions less verbose. Now that I've made it store active settings in an object instead of loose variables, it should be easier.
	const settingsCategories = [
		{
			title: "Head Tracking",
			settings: [
				{
					label: "Horizontal sensitivity",
					className: "tracky-mouse-sensitivity-x",
					// key: "headTrackingSensitivityX",
					load: (control, settings) => {
						if (settings.globalSettings.headTrackingSensitivityX !== undefined) {
							s.headTrackingSensitivityX = settings.globalSettings.headTrackingSensitivityX;
							control.value = s.headTrackingSensitivityX * 1000;
						}
					},
					loadValueFromControl: (control) => {
						s.headTrackingSensitivityX = control.value / 1000;
					},
					save: () => {
						setOptions({ globalSettings: { headTrackingSensitivityX: s.headTrackingSensitivityX } });
					},
					type: "slider",
					min: 0,
					max: 100,
					default: 25,
					labels: {
						min: "Slow",
						max: "Fast",
					},
				},
				{
					label: "Vertical sensitivity",
					className: "tracky-mouse-sensitivity-y",
					// key: "headTrackingSensitivityY",
					load: (control, settings) => {
						if (settings.globalSettings.headTrackingSensitivityY !== undefined) {
							s.headTrackingSensitivityY = settings.globalSettings.headTrackingSensitivityY;
							control.value = s.headTrackingSensitivityY * 1000;
						}
					},
					loadValueFromControl: (control) => {
						s.headTrackingSensitivityY = control.value / 1000;
					},
					save: () => {
						setOptions({ globalSettings: { headTrackingSensitivityY: s.headTrackingSensitivityY } });
					},
					type: "slider",
					min: 0,
					max: 100,
					default: 50,
					labels: {
						min: "Slow",
						max: "Fast",
					},
				},
				// {
				// 	label: "Smoothing",
				// 	className: "tracky-mouse-smoothing",
				// 	// key: "headTrackingSmoothing",
				// 	load: (control, settings) => {
				// 		if (settings.globalSettings.headTrackingSmoothing !== undefined) {
				// 			s.headTrackingSmoothing = settings.globalSettings.headTrackingSmoothing;
				// 			control.value = s.headTrackingSmoothing;
				// 		}
				// 	},
				// 	loadValueFromControl: (control) => {
				// 		s.headTrackingSmoothing = control.value;
				// 	},
				// 	save: () => {
				// 		setOptions({ globalSettings: { headTrackingSmoothing: s.headTrackingSmoothing } });
				// 	},
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
					// key: "headTrackingAcceleration",
					load: (control, settings) => {
						if (settings.globalSettings.headTrackingAcceleration !== undefined) {
							s.headTrackingAcceleration = settings.globalSettings.headTrackingAcceleration;
							control.value = s.headTrackingAcceleration * 100;
						}
					},
					loadValueFromControl: (control) => {
						s.headTrackingAcceleration = control.value / 100;
					},
					save: () => {
						setOptions({ globalSettings: { headTrackingAcceleration: s.headTrackingAcceleration } });
					},
					type: "slider",
					min: 0,
					max: 100,
					default: 50,
					labels: {
						min: "Linear", // or "Direct", "Raw"
						max: "Smooth",
					},
				},
				{
					label: "Motion threshold",
					className: "tracky-mouse-min-distance",
					// key: "headTrackingMinDistance",
					load: (control, settings) => {
						if (settings.globalSettings.headTrackingMinDistance !== undefined) {
							s.headTrackingMinDistance = settings.globalSettings.headTrackingMinDistance;
							control.value = s.headTrackingMinDistance;
						}
					},
					loadValueFromControl: (control) => {
						s.headTrackingMinDistance = control.value;
					},
					save: () => {
						setOptions({ globalSettings: { headTrackingMinDistance: s.headTrackingMinDistance } });
					},
					type: "slider",
					min: 0,
					max: 10,
					default: 0,
					labels: {
						min: "Free",
						max: "Steady",
					},
				},
				{
					label: "Tilt influence",
					className: "tracky-mouse-tilt-influence",
					// key: "headTrackingTiltInfluence",
					load: (control, settings) => {
						if (settings.globalSettings.headTrackingTiltInfluence !== undefined) {
							s.headTrackingTiltInfluence = settings.globalSettings.headTrackingTiltInfluence;
							control.value = s.headTrackingTiltInfluence * 100;
						}
					},
					loadValueFromControl: (control) => {
						s.headTrackingTiltInfluence = control.value / 100;
					},
					save: () => {
						setOptions({ globalSettings: { headTrackingTiltInfluence: s.headTrackingTiltInfluence } });
					},
					type: "slider",
					min: 0,
					max: 100,
					default: 0,
					labels: {
						min: "Optical flow",
						max: "Head tilt",
					},
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
			title: "Clicking",
			settings: [
				{
					label: "Clicking mode:", // TODO: ":"?
					className: "tracky-mouse-clicking-mode",
					// key: "clickingMode",
					load: (control, settings) => {
						if (settings.globalSettings.clickingMode !== undefined) {
							s.clickingMode = settings.globalSettings.clickingMode;
							control.value = s.clickingMode;
						}
					},
					loadValueFromControl: (control) => {
						s.clickingMode = control.value;
					},
					save: () => {
						setOptions({ globalSettings: { clickingMode: s.clickingMode } });
					},
					type: "dropdown",
					options: [
						{ value: "dwell", label: "Dwell to click" },
						{ value: "blink", label: "Wink to click" },
						{ value: "open-mouth", label: "Open mouth to click" },
						{ value: "off", label: "Off" },
					],
					default: "dwell",
					platform: "desktop",
				},
				{
					// TODO: add description of what this is for:
					// on Windows, currently, when buttons are swapped at the system level, it affects serenade-driver's click()
					// "swap" is purposefully generic language so we don't have to know what system-level setting is
					// (also this may be seen as a weirdly named/designed option for right-clicking with the dwell clicker)
					label: "Swap mouse buttons",
					className: "tracky-mouse-swap-mouse-buttons",
					// key: "swapMouseButtons",
					load: (control, settings) => {
						if (settings.globalSettings.swapMouseButtons !== undefined) {
							s.swapMouseButtons = settings.globalSettings.swapMouseButtons;
							control.checked = s.swapMouseButtons;
						}
					},
					loadValueFromControl: (control) => {
						s.swapMouseButtons = control.checked;
					},
					save: () => {
						setOptions({ globalSettings: { swapMouseButtons: s.swapMouseButtons } });
					},
					type: "checkbox",
					default: false,
					platform: "desktop",
				},

				// This setting could called "click stabilization", "drag delay", "delay before dragging", "click drag delay", "drag prevention", etc.
				// with slider labels "Easy to click -> Easy to drag" or "Easier to click -> Easier to drag" or "Short -> Long"
				// This could generalize into "never allow dragging" at the extreme, if it's special cased to jump to infinity
				// at the end of the slider, although you shouldn't need to do that to effectively avoid dragging when trying to click,
				// and it might complicate the design of the slider labeling.
				{
					label: "Delay before dragging&nbsp;&nbsp;&nbsp;", // TODO: avoid non-breaking space hack
					className: "tracky-mouse-delay-before-dragging",
					// key: "delayBeforeDragging",
					load: (control, settings) => {
						if (settings.globalSettings.delayBeforeDragging !== undefined) {
							s.delayBeforeDragging = settings.globalSettings.delayBeforeDragging;
							control.value = s.delayBeforeDragging;
						}
					},
					loadValueFromControl: (control) => {
						s.delayBeforeDragging = control.value;
					},
					save: () => {
						setOptions({ globalSettings: { delayBeforeDragging: s.delayBeforeDragging } });
					},
					type: "slider",
					min: 0,
					max: 1000,
					labels: {
						min: "Easy to drag",
						max: "Easy to click",
					},
					default: 0, // TODO: increase default
					platform: "desktop",
				},
			],
		},
		{
			title: "Video",
			settings: [
				{
					label: "Camera source",
					className: "tracky-mouse-camera-select",
					// key: "cameraDeviceId",
					load: (control, settings) => {
						if (settings.globalSettings.cameraDeviceId !== undefined) {
							s.cameraDeviceId = settings.globalSettings.cameraDeviceId;
							control.value = s.cameraDeviceId;
						}
					},
					loadValueFromControl: (control) => {
						s.cameraDeviceId = control.value;
					},
					save: () => {
						setOptions({ globalSettings: { cameraDeviceId: s.cameraDeviceId } });
					},
					handleSettingChange: () => {
						TrackyMouse.useCamera();
					},
					type: "dropdown",
					options: [
						{ value: "", label: "Default" },
					],
					default: "",
				},
				// TODO: try moving this to the corner of the camera view, so it's clearer it applies only to the camera view
				{
					label: "Mirror",
					className: "tracky-mouse-mirror",
					// key: "mirror",
					load: (control, settings) => {
						if (settings.globalSettings.mirror !== undefined) {
							s.mirror = settings.globalSettings.mirror;
							control.checked = s.mirror;
						}
					},
					loadValueFromControl: (control) => {
						s.mirror = control.checked;
					},
					save: () => {
						setOptions({ globalSettings: { mirror: s.mirror } });
					},
					type: "checkbox",
					default: true,
				},
			]
		},
		{
			title: "General",
			settings: [
				// opposite, "Start paused", might be clearer, especially if I add a "pause" button
				{
					label: "Start enabled",
					className: "tracky-mouse-start-enabled",
					// key: "startEnabled",
					load: (control, settings, initialLoad) => {
						if (settings.globalSettings.startEnabled !== undefined) {
							s.startEnabled = settings.globalSettings.startEnabled;
							control.checked = s.startEnabled;
							if (initialLoad) {
								paused = !s.startEnabled;
							}
						}
					},
					loadValueFromControl: (control) => {
						s.startEnabled = control.checked;
					},
					save: () => {
						setOptions({ globalSettings: { startEnabled: s.startEnabled } });
					},
					type: "checkbox",
					default: false,
				},
				{
					label: "Run at login",
					className: "tracky-mouse-run-at-login",
					// key: "runAtLogin",
					load: (control, settings) => {
						if (settings.globalSettings.runAtLogin !== undefined) {
							s.runAtLogin = settings.globalSettings.runAtLogin;
							control.checked = s.runAtLogin;
						}
					},
					loadValueFromControl: (control) => {
						s.runAtLogin = control.checked;
					},
					save: () => {
						setOptions({ globalSettings: { runAtLogin: s.runAtLogin } });
					},
					type: "checkbox",
					default: false,
					platform: "desktop",
				},
			],
		},
	];

	for (const category of settingsCategories) {
		const detailsEl = document.createElement("details");
		// detailsEl.className = "tracky-mouse-settings-category";
		if (category.settings.every(setting => setting.platform === "desktop")) {
			detailsEl.classList.add("tracky-mouse-desktop-only");
		}
		const summaryEl = document.createElement("summary");
		summaryEl.textContent = category.title;
		detailsEl.appendChild(summaryEl);
		const bodyEl = document.createElement("div");
		bodyEl.className = "tracky-mouse-details-body";
		for (const setting of category.settings) {
			// TODO: consider making everything use <label for=""> inside and <div> outside
			const rowEl = document.createElement(setting.type === "slider" ? "label" : "div");
			rowEl.className = "tracky-mouse-control-row";
			if (setting.type === "slider") {
				rowEl.innerHTML = `
					<span class="tracky-mouse-label-text">${setting.label}</span>
					<span class="tracky-mouse-labeled-slider">
						<input type="range" min="${setting.min}" max="${setting.max}" value="${setting.default}" class="${setting.className}">
						<span class="tracky-mouse-min-label">${setting.labels.min}</span>
						<span class="tracky-mouse-max-label">${setting.labels.max}</span>
					</span>
				`;
			} else if (setting.type === "checkbox") {
				// special interest: jspaint wants label not to use parent-child relationship so that os-gui's 98.css checkbox styles can work
				rowEl.innerHTML = `
					<input type="checkbox" id="${setting.className}" ${setting.default ? "checked" : ""} class="${setting.className}">
					<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
				`;
			} else if (setting.type === "dropdown") {
				const optionsHtml = setting.options.map(option => `
					<option value="${option.value}" ${option.value === setting.default ? "selected" : ""}>${option.label}</option>
				`.trim()).join("\n");
				rowEl.innerHTML = `
					<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
					<select id="${setting.className}" class="${setting.className}">
						${optionsHtml}
					</select>
				`;
			}
			if (setting.platform === "desktop") {
				rowEl.classList.add("tracky-mouse-desktop-only");
			}
			bodyEl.appendChild(rowEl);


			const control = rowEl.querySelector(`.${setting.className}`);
			// Load defaults
			setting.loadValueFromControl(control);
			// Handle changes
			control.addEventListener("change", () => {
				setting.loadValueFromControl(control);
				setting.save();
				// TODO: also call this if the setting is changed through CLI
				// Would be good to have a pattern where it's subscribing to changes to a settings store
				setting.handleSettingChange?.();
			});
		}
		detailsEl.appendChild(bodyEl);
		uiContainer.querySelector(".tracky-mouse-controls").appendChild(detailsEl);
	}

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
	var showDebugEyelidContours = false;
	var showDebugEyeZoom = true;

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
	};
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
		if ("globalSettings" in settings) {
			for (const category of settingsCategories) {
				for (const setting of category.settings) {
					if (setting.load) {
						const control = uiContainer.querySelector(`.${setting.className}`);
						if (control) {
							setting.load(control, settings, initialLoad);
						}
					}
				}
			}
		}
	}
	const formatVersion = 1;
	const formatName = "tracky-mouse-settings";
	function serializeSettings() {
		// TODO: DRY with serializeSettings in electron-main.js
		return {
			formatVersion,
			formatName,
			globalSettings: {
				startEnabled: s.startEnabled,
				runAtLogin: s.runAtLogin,
				swapMouseButtons: s.swapMouseButtons,
				clickingMode: s.clickingMode,
				mirrorCameraView: s.mirror,
				cameraDeviceId: s.cameraDeviceId,
				headTrackingSensitivityX: s.headTrackingSensitivityX,
				headTrackingSensitivityY: s.headTrackingSensitivityY,
				headTrackingAcceleration: s.headTrackingAcceleration,
				headTrackingMinDistance: s.headTrackingMinDistance,
				headTrackingTiltInfluence: s.headTrackingTiltInfluence,
				delayBeforeDragging: s.delayBeforeDragging,
			},
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

				let found = false;
				for (const device of videoDevices) {
					const option = document.createElement('option');
					option.value = device.deviceId;
					option.text = device.label || `Camera ${cameraSelect.length}`;
					cameraSelect.appendChild(option);
					if (device.deviceId === s.cameraDeviceId) {
						found = true;
					}
				}
				// Defaulting to "Default" would imply a preference isn't stored.
				// cameraSelect.value = found ? s.cameraDeviceId : "";
				// Show a placeholder for the selected camera
				if (s.cameraDeviceId && !found) {
					const option = document.createElement("option");
					option.value = s.cameraDeviceId;
					const knownInfo = knownCameras[s.cameraDeviceId];
					option.text = knownInfo ? `${knownInfo.name} (Unavailable)` : "Unavailable camera";
					cameraSelect.appendChild(option);
				}
				cameraSelect.value = s.cameraDeviceId;
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

		startStopButton.textContent = "Start";
		startStopButton.setAttribute("aria-pressed", "false");
	};

	useCameraButton.onclick = TrackyMouse.useCamera = async () => {
		await settingsLoadedPromise;
		const constraints = {
			audio: false,
			video: {
				width: defaultWidth,
				height: defaultHeight,
				facingMode: "user",
			}
		};
		if (s.cameraDeviceId) {
			delete constraints.video.facingMode;
			constraints.video.deviceId = { exact: s.cameraDeviceId };
		}
		navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
			populateCameraList();
			reset();

			cameraVideo.srcObject = stream;
			useCameraButton.hidden = true;
			errorMessage.hidden = true;
			if (!paused) {
				startStopButton.textContent = "Stop";
				startStopButton.setAttribute("aria-pressed", "true");
			}
		}, (error) => {
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
				errorMessage.textContent = "Webcam may already be in use. Please make sure you have no other programs using the camera.";
			} else if (error.name == "OverconstrainedError" || error.name == "ConstraintNotSatisfiedError") {
				// constraints can not be satisfied by avb. devices
				errorMessage.textContent = "Webcam does not support the required resolution. Please change your settings.";
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
			if (!paused) {
				return;
			}
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
							const top = keypoints[10];
							const chin = keypoints[152];
							const left = keypoints[454]; // Subject left (Image right)
							const right = keypoints[234]; // Subject right (Image left)

							if (top && chin && left && right) {
								// Pitch (X-axis rotation)
								const pitchDy = chin.y - top.y;
								const pitchDz = chin.z - top.z;
								headTilt.pitch = Math.atan2(pitchDz, Math.abs(pitchDy));

								// Yaw (Y-axis rotation)
								const yawDx = left.x - right.x;
								const yawDz = left.z - right.z;
								headTilt.yaw = Math.atan2(yawDz, Math.abs(yawDx));

								// Roll (Z-axis rotation)
								const rollDy = left.y - right.y;
								const rollDx = left.x - right.x;
								headTilt.roll = Math.atan2(rollDy, rollDx);
							}
						}

						let clickButton = -1;
						if (s.clickingMode === "blink" || showDebugEyeZoom || showDebugEyelidContours) {
							// Note: currently head tilt matters a lot, but ideally it should not.
							// - When moving closer to the camera, theoretically the eye size to head size ratio increases.
							//   (if you can hold your eye still, you can test by moving nearer to / further from the camera (or moving the camera))
							// - When tilting your head left or right, the contour of one closed eyelid becomes more curved* (as it wraps around your head),
							//   while the other stays near center of the visual region of your head and thus stays relatively straight (experiencing less projection distortion).
							// - When tilting your head down, the contour of a closed eyelid becomes more curved, which can lead to false negatives.
							// - When tilting your head up, the contour of an open eyelid becomes more straight, which can lead to false positives.
							// - *This is a geometric explanation, but in practice, facemesh loses the ability to detect
							//   whether the eye is closed when the head is tilted beyond a point.
							//   Enable `showDebugEyelidContours` to see the shapes we're dealing with here.
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

							function getEyeMetrics(eyeUpper, eyeLower) {
								// The lower eye keypoints have the corners
								const corners = [eyeLower[0], eyeLower[eyeLower.length - 1]];
								// Excluding the corners isn't really important since their measures will be 0.
								const otherPoints = eyeUpper.concat(eyeLower).filter(point => !corners.includes(point));
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

								const eyeWidth = Math.hypot(
									corners[0][0] - corners[1][0],
									corners[0][1] - corners[1][1]
								);
								const eyeHeight = highest - lowest;
								const eyeAspectRatio = eyeHeight / eyeWidth;
								return {
									corners,
									upperContour: eyeUpper,
									lowerContour: eyeLower,
									highest,
									lowest,
									eyeAspectRatio,
								};
							}

							const leftEye = getEyeMetrics(annotations.leftEyeUpper0, annotations.leftEyeLower0);
							const rightEye = getEyeMetrics(annotations.rightEyeUpper0, annotations.rightEyeLower0);

							const thresholdHigh = 0.2;
							const thresholdLow = 0.16;
							leftEye.open = leftEye.eyeAspectRatio > (blinkInfo?.leftEye.open ? thresholdLow : thresholdHigh);
							rightEye.open = rightEye.eyeAspectRatio > (blinkInfo?.rightEye.open ? thresholdLow : thresholdHigh);

							// An attempt at biasing the blink detection based on the other eye's state
							// (I'm not sure if this is the same as the idea I had noted above)
							// const threshold = 0.16;
							// const bias = 0.3;
							// leftEye.open = leftEye.eyeAspectRatio - threshold - ((rightEye.eyeAspectRatio - threshold) * bias) > 0;
							// rightEye.open = rightEye.eyeAspectRatio - threshold - ((leftEye.eyeAspectRatio - threshold) * bias) > 0;

							// Involuntary blink rejection
							const blinkRejectDuration = 100; // milliseconds
							const currentTime = performance.now();
							// TODO: DRY
							if (leftEye.open === blinkInfo?.leftEye.open) {
								leftEye.timeSinceChange = blinkInfo?.leftEye.timeSinceChange ?? currentTime;
							} else {
								leftEye.timeSinceChange = currentTime;
							}
							if (rightEye.open === blinkInfo?.rightEye.open) {
								rightEye.timeSinceChange = blinkInfo?.rightEye.timeSinceChange ?? currentTime;
							} else {
								rightEye.timeSinceChange = currentTime;
							}
							const timeSinceChange = currentTime - Math.max(leftEye.timeSinceChange, rightEye.timeSinceChange);
							leftEye.winking = timeSinceChange > blinkRejectDuration && rightEye.open && !leftEye.open;
							rightEye.winking = timeSinceChange > blinkRejectDuration && leftEye.open && !rightEye.open;

							if (rightEye.winking) {
								clickButton = 0;
							} else if (leftEye.winking) {
								clickButton = 2;
							}
							blinkInfo = {
								leftEye,
								rightEye
							};
						} else {
							blinkInfo = null;
						}
						if (s.clickingMode === "open-mouth") {
							// TODO: modifiers with eye closing or eyebrow raising to trigger different buttons
							// TODO: refactor and move this code (it's too nested)
							// TODO: headSize is not a perfect measurement; try alternative measurements, e.g.
							// - mouth width (implies making an "O" mouth shape would be favored over a wide open mouth shape)
							const mid = Math.floor(annotations.lipsLowerInner.length / 2);
							const mouthTopBottomPoints = [
								annotations.lipsUpperInner[mid],
								annotations.lipsLowerInner[mid]
							];
							const mouthTopBottomDistance = Math.hypot(
								annotations.lipsUpperInner[mid][0] - annotations.lipsLowerInner[mid][0],
								annotations.lipsUpperInner[mid][1] - annotations.lipsLowerInner[mid][1]
							);
							const headSize = Math.hypot(
								annotations.leftCheek[0][0] - annotations.rightCheek[0][0],
								annotations.leftCheek[0][1] - annotations.rightCheek[0][1]
							);
							const thresholdHigh = headSize * 0.15;
							const thresholdLow = headSize * 0.1;
							// console.log("mouthTopBottomDistance", mouthTopBottomDistance, "threshold", threshold);
							const mouthOpen = mouthTopBottomDistance > (mouthInfo?.mouthOpen ? thresholdLow : thresholdHigh);
							if (mouthOpen) {
								clickButton = 0;
							}
							mouthInfo = {
								mouthOpen,
								mouthTopBottomPoints,
								corners: [annotations.lipsUpperInner[0], annotations.lipsUpperInner[annotations.lipsUpperInner.length - 1]],
								mouthOpenDistance: mouthTopBottomDistance / headSize,
							};
						} else {
							mouthInfo = null;
						}

						// TODO: implement these clicking modes for the web library version
						// and unhide the "Clicking mode" setting in the UI
						// https://github.com/1j01/tracky-mouse/issues/72
						if ((clickButton === 0) !== buttonStates.left) {
							window.electronAPI?.setMouseButtonState(false, clickButton === 0);
							buttonStates.left = clickButton === 0;
							if ((clickButton === 0)) {
								lastMouseDownTime = performance.now();
							} else {
								// Limit "Delay Before Dragging" effect to the duration of a click.
								// TODO: consider how this affects releasing a mouse button if two are pressed (not currently possible)
								// TODO: rename variable, maybe change it to store a cool-down timer? but that would need more state management just for concept clarity
								lastMouseDownTime = -Infinity; // sorry, making this variable a misnomer
							}
						}
						if ((clickButton === 2) !== buttonStates.right) {
							window.electronAPI?.setMouseButtonState(true, clickButton === 2);
							buttonStates.right = clickButton === 2;
							if ((clickButton === 2)) {
								lastMouseDownTime = performance.now();
							} else {
								lastMouseDownTime = -Infinity; // sorry, making this variable a misnomer
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
			if (keypoints) {
				const top = keypoints[10];
				const chin = keypoints[152];
				const left = keypoints[454]; // Subject left (Image right)
				const right = keypoints[234]; // Subject right (Image left)
				const nose = keypoints[1];

				if (top && chin && left && right && nose) {

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
					const vUp = { x: top.x - chin.x, y: top.y - chin.y, z: top.z - chin.z }; // Up vector (Chin to Top)
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

		if (s.clickingMode === "blink" && blinkInfo) {
			ctx.save();
			ctx.lineWidth = 2;
			const drawEye = (eye) => {
				ctx.strokeStyle = eye.winking ? "red" : eye.open ? "cyan" : "yellow";
				ctx.beginPath();
				ctx.moveTo(eye.corners[0][0], eye.corners[0][1]);
				ctx.lineTo(eye.corners[1][0], eye.corners[1][1]);
				ctx.stroke();
				// draw extents as a rectangle
				ctx.save();
				ctx.translate(eye.corners[0][0], eye.corners[0][1]);
				ctx.rotate(Math.atan2(eye.corners[1][1] - eye.corners[0][1], eye.corners[1][0] - eye.corners[0][0]));
				ctx.beginPath();
				ctx.rect(0, eye.lowest, Math.hypot(eye.corners[1][0] - eye.corners[0][0], eye.corners[1][1] - eye.corners[0][1]), eye.highest - eye.lowest);
				ctx.stroke();
				ctx.restore();
				// Zoom in and show the eyelid contour SHAPE, for qualitative debugging
				// This helps to show that the facemesh model doesn't really know whether your eye is open or closed beyond a certain head angle.
				// Therefore there's not much we can do using the eyelid contour to improve blink detection.
				// We might be able to tease a little more accuracy out of it using surrounding points in some clever way, 3D information, etc.
				// but fundamentally, garbage in, garbage out.
				if (showDebugEyelidContours) {
					const eyeCenter = [(eye.corners[0][0] + eye.corners[1][0]) / 2, (eye.corners[0][1] + eye.corners[1][1]) / 2];
					ctx.save();
					ctx.translate(eyeCenter[0], eyeCenter[1]);
					ctx.scale(5, 5);
					ctx.translate(-eyeCenter[0], -eyeCenter[1]);
					ctx.strokeStyle = "green";
					ctx.beginPath();
					for (const contour of [eye.upperContour, eye.lowerContour]) {
						for (let i = 0; i < contour.length; i++) {
							const [x, y] = contour[i];
							if (i === 0) {
								ctx.moveTo(x, y);
							} else {
								ctx.lineTo(x, y);
							}
						}
					}
					ctx.lineWidth = 2 / 5;
					ctx.stroke();
					ctx.restore();
				}
			};
			drawEye(blinkInfo.leftEye);
			drawEye(blinkInfo.rightEye);

			if (showDebugEyeZoom) {
				debugEyeCanvas.style.display = "";
				const boxWidth = 150;
				const boxHeight = 100;

				if (debugEyeCanvas.width !== boxWidth * 2) {
					debugEyeCanvas.width = boxWidth * 2;
					debugEyeCanvas.height = boxHeight;
				}

				debugEyeCtx.fillStyle = "black";
				debugEyeCtx.fillRect(0, 0, debugEyeCanvas.width, debugEyeCanvas.height);

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
			} else {
				debugEyeCanvas.style.display = "none";
			}
			ctx.restore();
		}
		if (s.clickingMode === "open-mouth" && mouthInfo) {
			ctx.save();
			ctx.lineWidth = 2;
			ctx.strokeStyle = mouthInfo.mouthOpen ? "red" : "cyan";
			ctx.beginPath();
			// ctx.moveTo(mouthInfo.mouthTopBottomPoints[0][0], mouthInfo.mouthTopBottomPoints[0][1]);
			// ctx.lineTo(mouthInfo.corners[0][0], mouthInfo.corners[0][1]);
			// ctx.lineTo(mouthInfo.mouthTopBottomPoints[1][0], mouthInfo.mouthTopBottomPoints[1][1]);
			// ctx.lineTo(mouthInfo.corners[1][0], mouthInfo.corners[1][1]);
			// ctx.closePath();
			const mouthCenter = [
				(mouthInfo.corners[0][0] + mouthInfo.corners[1][0]) / 2,
				(mouthInfo.corners[0][1] + mouthInfo.corners[1][1]) / 2
			];
			const extents = mouthInfo.mouthTopBottomPoints.map(point => signedDistancePointLine(point, mouthInfo.corners[0], mouthInfo.corners[1]));
			// Draw as two lines rather than a rectangle (or ellipse) to indicate that it's not using aspect ratio of the mouth currently
			// const highest = Math.max(...extents);
			// const lowest = Math.min(...extents);
			// const mouthWidth = Math.hypot(mouthInfo.corners[1][0] - mouthInfo.corners[0][0], mouthInfo.corners[1][1] - mouthInfo.corners[0][1]);
			const mouthWidth = 50;
			ctx.translate(mouthCenter[0], mouthCenter[1]);
			ctx.rotate(Math.atan2(mouthInfo.corners[1][1] - mouthInfo.corners[0][1], mouthInfo.corners[1][0] - mouthInfo.corners[0][0]));
			ctx.beginPath();
			// ctx.rect(-mouthWidth / 2, lowest, mouthWidth, highest - lowest);
			for (const extent of extents) {
				ctx.moveTo(-mouthWidth / 2, extent);
				ctx.lineTo(mouthWidth / 2, extent);
			}
			ctx.stroke();
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
				const yawRange = [-30 * Math.PI / 180, 30 * Math.PI / 180];
				const pitchRange = [-10 * Math.PI / 180, 15 * Math.PI / 180];

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

	const updatePaused = () => {
		mouseNeedsInitPos = true;
		if (paused) {
			pointerEl.style.display = "none";
		}
		if (paused) {
			startStopButton.textContent = "Start";
			startStopButton.setAttribute("aria-pressed", "false");
		} else {
			startStopButton.textContent = "Stop";
			startStopButton.setAttribute("aria-pressed", "true");
		}
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
