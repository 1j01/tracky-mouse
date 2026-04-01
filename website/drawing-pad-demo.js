export class DrawingPad {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		if (!this.container) throw new Error("Container not found");

		// Make container focusable so keyboard events can be scoped to it
		this.container.tabIndex = 0;

		this.svgNS = "http://www.w3.org/2000/svg";

		this.undoStack = [];
		this.redoStack = [];

		this._buildUI();
		this._bindDrawingEvents();
		this._bindKeyboard();
	}

	_buildUI() {
		// Toolbar
		this.toolbar = document.createElement("div");
		this.toolbar.style.display = "flex";
		this.toolbar.style.gap = "8px";
		this.toolbar.style.marginBottom = "6px";

		this.undoBtn = document.createElement("button");
		this.undoBtn.textContent = "Undo";

		this.redoBtn = document.createElement("button");
		this.redoBtn.textContent = "Redo";

		this.clearBtn = document.createElement("button");
		this.clearBtn.textContent = "Clear";

		this.toolbar.append(this.undoBtn, this.redoBtn, this.clearBtn);

		// SVG canvas
		this.svg = document.createElementNS(this.svgNS, "svg");
		this.svg.setAttribute("width", "100%");
		this.svg.setAttribute("height", "400");
		this.svg.style.background = "#fff";
		this.svg.style.touchAction = "none";

		this.svg.innerHTML = `
			<defs>
				<pattern id="drawing-pad-checker" width="100" height="100" patternUnits="userSpaceOnUse">
					<rect width="50" height="50" fill="#cfcfcf"/>
					<rect x="50" y="50" width="50" height="50" fill="#cfcfcf"/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#drawing-pad-checker)" />
		`;

		this.container.append(this.toolbar, this.svg);

		// Button actions
		this.undoBtn.onclick = () => this.undo();
		this.redoBtn.onclick = () => this.redo();
		this.clearBtn.onclick = () => this.clear();
	}

	_bindDrawingEvents() {
		this.isDrawing = false;
		this.currentPath = null;
		this.points = [];

		this.svg.addEventListener("pointerdown", (e) => this._start(e));
		this.svg.addEventListener("pointermove", (e) => this._move(e));
		this.svg.addEventListener("pointerup", () => this._end());
		this.svg.addEventListener("pointerleave", () => this._end());
	}

	_bindKeyboard() {
		this.container.addEventListener("keydown", (e) => {
			const key = e.key.toLowerCase();
			const isMod = e.ctrlKey || e.metaKey;

			if (!isMod) return;

			if (key === "z" && e.shiftKey) {
				e.preventDefault();
				this.redo();
			} else if (key === "z") {
				e.preventDefault();
				this.undo();
			} else if (key === "y") {
				e.preventDefault();
				this.redo();
			}
		});
	}

	_getPoint(e) {
		const rect = this.svg.getBoundingClientRect();
		return {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		};
	}

	_start(e) {
		this.isDrawing = true;
		this.points = [];

		const p = this._getPoint(e);
		this.points.push(p);

		this.currentPath = document.createElementNS(this.svgNS, "path");
		this.currentPath.setAttribute("fill", "none");
		this.currentPath.setAttribute("stroke", "#000");
		this.currentPath.setAttribute("stroke-width", "2");

		this.svg.appendChild(this.currentPath);
		this._updatePath();
	}

	_move(e) {
		if (!this.isDrawing) return;

		const p = this._getPoint(e);
		this.points.push(p);
		this._updatePath();
	}

	_end() {
		if (!this.isDrawing) return;
		this.isDrawing = false;

		if (this.currentPath) {
			this.undoStack.push(this.currentPath);
			this.redoStack = [];
		}

		this.currentPath = null;
		this.points = [];
	}

	_updatePath() {
		if (!this.points.length) return;

		let d = `M ${this.points[0].x} ${this.points[0].y}`;
		for (let i = 1; i < this.points.length; i++) {
			const p = this.points[i];
			d += ` L ${p.x} ${p.y}`;
		}

		this.currentPath.setAttribute("d", d);
	}

	undo() {
		const el = this.undoStack.pop();
		if (!el) return;

		this.svg.removeChild(el);
		this.redoStack.push(el);
	}

	redo() {
		const el = this.redoStack.pop();
		if (!el) return;

		this.svg.appendChild(el);
		this.undoStack.push(el);
	}

	clear() {
		// Remove all path elements but keep the defs + checker background
		this.svg.querySelectorAll("path").forEach(path => path.remove());
		this.undoStack = [];
		this.redoStack = [];
	}
}