import * as THREE from "three";

class DancerTile {
	symbol = '';

	depth = 0;

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
	 */
	constructor(symbol, parent = null) {
		this.symbol = symbol;
		this.parent = parent;
		this.mesh = new THREE.Mesh(this.plane, new THREE.MeshStandardMaterial({ color: 'white' }));
	}
}

export class DancerCore {
	text = '';

	root = new DancerTile();

	group = new THREE.Group();

	constructor() {
		this.group.add(this.root.mesh);
		this.populate(this.root);
	}

	/** @param {DancerTile} parentTile */
	populate(parentTile) {
		if (parentTile.depth >= 3) return;

		const symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ',.!? ".split('');
		for (const symbol of symbols) {
			const childTile = new DancerTile(symbol, parentTile);
			childTile.depth = parentTile.depth + 1;
			parentTile.children.push(childTile);
			this.group.add(childTile.mesh);
			this.populate(childTile);
		}
	}
}
