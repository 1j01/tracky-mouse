
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

// TODO: scroll containers, not just the window
// TODO: conditionally show arrows according to scrollable axes
// TODO: exponential speed curve
// TODO: deadzone (zero speed zone)
// TODO: block clicks while autoscrolling with a full-page transparent element,
// so it doesn't doubly-act when stopping locked autoscroll with a click.

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
		if (Math.hypot(x - this._start.x, y - this._start.y) < 5) {
			return; // lock autoscroll mode until next click
		}
		this.stopAutoscroll();
	},
	startAutoscroll(target, x, y) {
		indicator.style.left = `${x}px`;
		indicator.style.top = `${y}px`;
		document.body.appendChild(indicator);
		this._start = { x, y, target };
	},
	stopAutoscroll() {
		this._start = null;
		if (indicator.parentElement) {
			document.body.removeChild(indicator);
		}
	},
	pointerMove(_target, x, y) {
		if (!this._start) return;
		const diff = { x: x - this._start.x, y: y - this._start.y };
		const scrollSpeed = 0.5;
		window.scrollBy(diff.x * scrollSpeed, diff.y * scrollSpeed);
	},
};
