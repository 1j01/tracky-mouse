#!/usr/bin/env node

/*
ChatGPT prompt:

"Node.js script to copy files between directories, using an include list and exclude list of globs. If something is matched by neither (unknown) or both (conflict), the script should wait for the user to change the patterns, and refresh the result interactively, prompting for confirmation to continue once it becomes valid. It should show a minimal tree view of included and unknown files/folders, without showing excluded files/folders or traversing into folders when the contents are all marked the same as the parent folder."
(+ followup prompt: "> Re-evaluates automatically on Enter
That's not automatic. It should watch the file.")
*/

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const picomatch = require("picomatch");
const readline = require("readline");

const SRC = path.resolve("src");
const DEST = path.resolve("dest");
const PATTERN_FILE = path.resolve("patterns.js");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

let awaitingConfirmation = false;
let debounceTimer = null;

function loadPatterns() {
	delete require.cache[require.resolve(PATTERN_FILE)];
	return require(PATTERN_FILE);
}

function walkAll(root) {
	return fg.sync(["**/*"], {
		cwd: root,
		dot: true,
		onlyFiles: false,
		followSymbolicLinks: false
	});
}

function classify(paths, include, exclude) {
	const inc = picomatch(include);
	const exc = picomatch(exclude);

	const map = new Map();

	for (const p of paths) {
		const i = inc(p);
		const e = exc(p);

		map.set(
			p,
			i && e ? "conflict" :
				i ? "included" :
					e ? "excluded" :
						"unknown"
		);
	}

	return map;
}

function buildTree(paths) {
	const root = {};
	for (const p of paths) {
		const parts = p.split(path.sep);
		let n = root;
		for (const part of parts) {
			n.children ||= {};
			n.children[part] ||= {};
			n = n.children[part];
		}
	}
	return root;
}

function compress(tree, statuses, prefix = "") {
	const out = [];

	for (const [name, node] of Object.entries(tree.children || {})) {
		const full = prefix ? path.join(prefix, name) : name;

		const s = [];
		for (const [p, st] of statuses) {
			if (p === full || p.startsWith(full + path.sep)) {
				s.push(st);
			}
		}

		const uniq = new Set(s);

		if (uniq.size === 1) {
			out.push({
				name: node.children ? name + "/" : name,
				status: [...uniq][0]
			});
		} else {
			out.push({
				name: name + "/",
				children: compress(node, statuses, full)
			});
		}
	}

	return out;
}

function print(entries, indent = "") {
	for (const e of entries) {
		if (e.status) {
			if (e.status !== "excluded") {
				console.log(`${indent}${e.name} (${e.status})`);
			}
		} else {
			console.log(`${indent}${e.name}`);
			print(e.children, indent + "  ");
		}
	}
}

function hasInvalid(statuses) {
	for (const s of statuses.values()) {
		if (s === "unknown" || s === "conflict") return true;
	}
	return false;
}

function copy(statuses) {
	for (const [p, s] of statuses) {
		if (s !== "included") continue;

		const src = path.join(SRC, p);
		const dst = path.join(DEST, p);

		fs.mkdirSync(path.dirname(dst), { recursive: true });
		if (fs.statSync(src).isFile()) {
			fs.copyFileSync(src, dst);
		}
	}
}

function evaluate() {
	let patterns;
	try {
		patterns = loadPatterns();
	} catch (e) {
		console.clear();
		console.log("Failed to load patterns.js");
		console.log(e.message);
		return;
	}

	const all = walkAll(SRC);
	const statuses = classify(all, patterns.include, patterns.exclude);

	const visible = [...statuses.entries()]
		.filter(([, s]) => s === "included" || s === "unknown")
		.map(([p]) => p);

	console.clear();
	const tree = buildTree(visible);
	const compressed = compress(tree, statuses);
	print(compressed);

	if (hasInvalid(statuses)) {
		awaitingConfirmation = false;
		console.log("\nWaiting for patterns.js to become valid…");
		return;
	}

	if (awaitingConfirmation) return;
	awaitingConfirmation = true;

	rl.question("\nAll files resolved. Proceed with copy? (y/n) ", ans => {
		if (ans.toLowerCase() === "y") {
			copy(statuses);
			console.log("Copy complete.");
			process.exit(0);
		} else {
			awaitingConfirmation = false;
		}
	});
}

function watchPatterns() {
	fs.watch(PATTERN_FILE, () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(evaluate, 100);
	});
}

evaluate();
watchPatterns();
