import * as THREE from "three";

class DancerTile {
	symbol = '';

	depth = 0;

	box = new THREE.Box2();

	plane = new THREE.PlaneGeometry();

	/** @type {THREE.Mesh} */
	mesh;

	/** @type {DancerTile[]} */
	children = [];

	/** @type {DancerTile | null} */
	parent = null;

	/**
	 * @param {string} symbol
	 * @param {DancerTile | null} parent
	 * @param {DancerCore} core
	 */
	constructor(symbol, parent, core) {
		this.symbol = symbol;
		this.parent = parent;
		this.mesh = new THREE.Mesh(this.plane, core.fontMaterial || new THREE.MeshStandardMaterial({ color: 'white' }));
		// configure UVs to show the correct character from the font texture
		const charIndex = symbol ? core.alphabet.indexOf(symbol) : 0;
		const uvs = this.plane.attributes.uv.array;
		uvs[0] = charIndex / core.alphabet.length; uvs[1] = 1;
		uvs[2] = (charIndex + 1) / core.alphabet.length; uvs[3] = 1;
		uvs[4] = charIndex / core.alphabet.length; uvs[5] = 0;
		uvs[6] = (charIndex + 1) / core.alphabet.length; uvs[7] = 0;
		this.plane.attributes.uv.needsUpdate = true;
	}
}

export class DancerCore {
	text = '';

	// alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ',.!? ".split('');
	alphabet = "ABCD".split('');

	root = new DancerTile('', null, this);

	/** @type {HTMLCanvasElement} */
	fontCanvas = null;

	/** @type {THREE.CanvasTexture} */
	fontTexture = null;

	/** @type {THREE.MeshBasicMaterial} */
	fontMaterial = null;

	/** @type {THREE.Group} */
	group = new THREE.Group();

	constructor() {
		this.generateFontTexture();

		this.root.box = new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1));
		this.group.add(this.root.mesh);
		this.populate(this.root);
	}

	generateFontTexture() {
		this.fontCanvas = document.createElement('canvas');
		const charWidth = 64;
		const charHeight = 64;
		this.fontCanvas.width = this.alphabet.length * charWidth;
		this.fontCanvas.height = charHeight;
		const ctx = this.fontCanvas.getContext('2d');
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, this.fontCanvas.width, this.fontCanvas.height);
		ctx.fillStyle = 'white';
		ctx.font = '48px sans-serif';
		ctx.textBaseline = 'top';
		for (let i = 0; i < this.alphabet.length; i++) {
			const char = this.alphabet[i];
			ctx.fillText(char, i * charWidth, 0);
		}
		this.fontTexture = new THREE.CanvasTexture(this.fontCanvas);
		this.fontMaterial = new THREE.MeshBasicMaterial({ map: this.fontTexture, transparent: true });
	}

	/** @param {DancerTile} parentTile */
	populate(parentTile) {
		if (parentTile.depth >= 3) return;

		for (let i = 0; i < this.alphabet.length; i++) {
			const symbol = this.alphabet[i];

			const childTile = new DancerTile(symbol, parentTile, this);
			childTile.depth = parentTile.depth + 1;
			const childSize = (parentTile.box.max.x - parentTile.box.min.x) / this.alphabet.length;
			childTile.box = new THREE.Box2(
				new THREE.Vector2(
					parentTile.box.max.x,
					parentTile.box.min.y + childSize * i
				),
				new THREE.Vector2(
					parentTile.box.max.x + childSize,
					parentTile.box.min.y + childSize * (i + 1),
				)
			);
			childTile.mesh.position.set(
				(childTile.box.min.x + childTile.box.max.x) / 2,
				(childTile.box.min.y + childTile.box.max.y) / 2,
				0,
			);
			childTile.mesh.scale.set(
				(childTile.box.max.x - childTile.box.min.x),
				(childTile.box.max.y - childTile.box.min.y),
				1
			);
			parentTile.children.push(childTile);
			this.group.add(childTile.mesh);
			this.populate(childTile);
		}
	}
}
