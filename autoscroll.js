
const indicator = document.createElement("div");
indicator.innerHTML = `
	<svg width="32" height="32" viewBox="0 0 32 32">
		<!-- base shape -->
		<circle cx="16" cy="16" r="13" fill="rgb(230, 230, 230)" stroke="rgb(50, 50, 50)" stroke-width="1" />
		<!-- middle dot -->
		<circle cx="16" cy="16" r="2" fill="rgb(0, 0, 0)" />
		<!-- triangle above -->
		<polygon data-axis="y" points="16,5 13,10 19,10" fill="rgb(0, 0, 0)" />
		<!-- triangle below -->
		<polygon data-axis="y" points="16,27 13,22 19,22" fill="rgb(0, 0, 0)" />
		<!-- triangle left -->
		<polygon data-axis="x" points="5,16 10,13 10,19" fill="rgb(0, 0, 0)" />
		<!-- triangle right -->
		<polygon data-axis="x" points="27,16 22,13 22,19" fill="rgb(0, 0, 0)" />
	</svg>
`;
indicator.style.position = "fixed";
indicator.style.pointerEvents = "none";
indicator.style.transform = "translate(-50%, -50%)";
indicator.style.zIndex = "800000"; // below .tracky-mouse-cursor and inputFeedbackCanvas

const lockingClickRadius = 10; // pixels
const scrollSpeed = 0.01;
const scrollExponent = 1.6;
const deadZone = 10; // pixels (taxicab distance)
const maxDeltaTime = 100; // milliseconds


// Block clicks with a full-page transparent element while autoscrolling,
// so it doesn't doubly-act when stopping locked autoscroll with a click.
const clickBlocker = document.createElement("div");
clickBlocker.style.position = "fixed";
clickBlocker.style.left = "0";
clickBlocker.style.top = "0";
clickBlocker.style.width = "100%";
clickBlocker.style.height = "100%";
clickBlocker.style.zIndex = "1000000";
clickBlocker.style.pointerEvents = "auto"; // default
clickBlocker.style.backgroundColor = "transparent"; // default (but could override weird CSS ig)
clickBlocker.addEventListener("pointerdown", (event) => {
	event.stopPropagation();
	event.preventDefault();
	autoscroll.stopAutoscroll();
});

export const autoscroll = {
	_start: null,
	_currentScrollDelta: null,
	_lastTimestamp: null,
	_animationFrameRequest: null,
	pointerDown(target, x, y, buttonIndex = 0) {
		if (buttonIndex !== 1) {
			this.stopAutoscroll();
			return;
		}
		if (target.closest("a")) return;
		this.startAutoscroll(target, x, y);
	},
	pointerUp(_target, x, y, buttonIndex = 0) {
		if (buttonIndex !== 1) return;
		if (Math.hypot(x - this._start.x, y - this._start.y) < lockingClickRadius) {
			return; // lock autoscroll mode until next click
		}
		this.stopAutoscroll();
	},
	startAutoscroll(target, x, y) {
		indicator.style.left = `${x}px`;
		indicator.style.top = `${y}px`;
		document.body.appendChild(indicator);
		document.body.appendChild(clickBlocker);
		this._start = { x, y, target };
		this._currentScrollDelta = null;
		this._lastTimestamp = performance.now();
		// Update arrow visibility immediately, and start animation loop
		this.updateAutoscroll();
	},
	stopAutoscroll() {
		this._start = null;
		if (indicator.parentElement) {
			document.body.removeChild(indicator);
		}
		if (clickBlocker.parentElement) {
			document.body.removeChild(clickBlocker);
		}
		cancelAnimationFrame(this._animationFrameRequest);
		this._animationFrameRequest = null;
	},
	pointerMove(_target, x, y) {
		if (!this._start) return;
		const diff = { x: x - this._start.x, y: y - this._start.y };
		// Note: Don't return early if within deadzone,
		// because we still want to update the indicator arrows.
		if (Math.abs(diff.x) < deadZone) diff.x = 0;
		if (Math.abs(diff.y) < deadZone) diff.y = 0;
		diff.x -= Math.sign(diff.x) * deadZone;
		diff.y -= Math.sign(diff.y) * deadZone;

		// Note: there's a question of whether to apply the exponent or multiplier first.
		// I think with exponent after multiplier, adjusting the exponent changes the
		// average speed less for nominal values of input/exponent/multiplier,
		// making it more intuitive to tweak the curvature,
		// but tweaking the multiplier may be more intuitive, at least in a strict mathematical sense,
		// with the exponent applied first.
		// The set of curves expressible should be equal.
		// As an aside, switching between the two orders could be easier if we used one variable
		// instead of both `diff` and `scrollDelta`. I doubt it would harm clarity.
		const scrollDelta = { x: diff.x * scrollSpeed, y: diff.y * scrollSpeed };
		scrollDelta.x = Math.sign(scrollDelta.x) * Math.pow(Math.abs(scrollDelta.x), scrollExponent);
		scrollDelta.y = Math.sign(scrollDelta.y) * Math.pow(Math.abs(scrollDelta.y), scrollExponent);
		this._currentScrollDelta = scrollDelta;
	},
	getScrollable() {
		let container = this._start.target;
		let canScrollX = false;
		let canScrollY = false;
		while (container && container !== document.body) {
			// This initial test gives a false positive on the demo section of the website
			// Trying an actual scroll seems like a sure test, but could cause performance issues
			canScrollX = container.scrollWidth > container.clientWidth;
			canScrollY = container.scrollHeight > container.clientHeight;
			if (canScrollX || canScrollY) {
				if (canScrollX) {
					const oldScrollLeft = container.scrollLeft;
					container.scrollLeft = 1;
					if (container.scrollLeft === 0) {
						canScrollX = false;
					}
					container.scrollLeft = oldScrollLeft;
				}
				if (canScrollY) {
					const oldScrollTop = container.scrollTop;
					container.scrollTop = 1;
					if (container.scrollTop === 0) {
						canScrollY = false;
					}
					container.scrollTop = oldScrollTop;
				}
			}
			if (canScrollX || canScrollY) {
				break;
			}
			container = container.parentElement;
		}
		if (!container || container === document.body) {
			// container = document.scrollingElement;
			container = window;
			canScrollX = document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth;
			canScrollY = document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight;
		}
		return { container, canScrollX, canScrollY };
	},
	updateAutoscroll() {
		const deltaTime = Math.min(maxDeltaTime, performance.now() - this._lastTimestamp);
		// Note: we could optimize by not calling getScrollable every frame
		const { container, canScrollX, canScrollY } = this.getScrollable();
		const scrollDelta = this._currentScrollDelta;
		if (scrollDelta) {
			// Note: scrolling might be limited to integers, which could cause it to not scroll at low speeds,
			// especially at high frame rates,
			// and affect the accuracy of deltaTime-based movement. We could accumulate fractional scroll
			// deltas and apply them when they reach a whole pixel.
			container.scrollBy(scrollDelta.x * deltaTime, scrollDelta.y * deltaTime);
		}

		for (const arrow of indicator.querySelectorAll("[data-axis]")) {
			const axis = arrow.dataset.axis;
			arrow.style.display = (axis === "x" ? canScrollX : canScrollY) ? "" : "none";
		}

		this._lastTimestamp = performance.now();

		cancelAnimationFrame(this._animationFrameRequest);
		this._animationFrameRequest = requestAnimationFrame(() => this.updateAutoscroll());
	},
};
