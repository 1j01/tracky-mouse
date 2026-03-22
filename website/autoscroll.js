
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

// TODO: exponential speed curve

const lockingClickRadius = 10; // pixels
const scrollSpeed = 0.5; // scrolled pixels per pixel of distance from start point
const deadZone = 10; // pixels (taxicab distance)

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
		// Update arrow visibility immediately
		// Note: pointermove ought to be sent when pointerdown happens
		// in which case this wouldn't be needed
		this.pointerMove(target, x, y);
	},
	stopAutoscroll() {
		this._start = null;
		if (indicator.parentElement) {
			document.body.removeChild(indicator);
		}
		if (clickBlocker.parentElement) {
			document.body.removeChild(clickBlocker);
		}
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

		const scrollDelta = { x: diff.x * scrollSpeed, y: diff.y * scrollSpeed };

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
		container.scrollBy(scrollDelta.x, scrollDelta.y);

		for (const arrow of indicator.querySelectorAll("[data-axis]")) {
			const axis = arrow.dataset.axis;
			arrow.style.display = (axis === "x" ? canScrollX : canScrollY) ? "" : "none";
		}
	},
};
