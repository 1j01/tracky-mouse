
const indicator = document.createElement("div");
indicator.style.position = "fixed";
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

// TODO: click and release + drag behavior (in addition to click and drag behavior)
// TODO: scroll containers, not just the window
// TODO: conditionally show arrows according to scrollable axes
// TODO: exponential speed curve
// TODO: deadzone (zero speed zone)

export const autoscroll = {
	pointerDown(target, x, y, buttonIndex = 0) {
		if (buttonIndex !== 1) return;
		indicator.style.left = `${x}px`;
		indicator.style.top = `${y}px`;
		document.body.appendChild(indicator);
		this._start = { x, y, target };
	},
	pointerUp(_target, _x, _y, buttonIndex = 0) {
		if (buttonIndex !== 1) return;
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
	}
};
