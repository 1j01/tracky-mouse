#!/usr/bin/env node

/*
ChatGPT prompt:

"Node.js script to copy files between directories, using an include list and exclude list of globs. If something is matched by neither (unknown) or both (conflict), the script should wait for the user to change the patterns, and refresh the result interactively, prompting for confirmation to continue once it becomes valid. It should show a minimal tree view of included and unknown files/folders, without showing excluded files/folders or traversing into folders when the contents are all marked the same as the parent folder."
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

function loadPatterns() {
	delete require.cache[require.resolve(PATTERN_FILE)];
	return require(PATTERN_FILE);
}

function walkAllFiles(root) {
	return fg.sync(["**/*"], {
		cwd: root,
		dot: true,
		onlyFiles: false,
		followSymbolicLinks: false
	});
}

function classify(allPaths, include, exclude) {
	const isInclude = picomatch(include);
	const isExclude = picomatch(exclude);

	const result = new Map();

	for (const p of allPaths) {
		const inc = isInclude(p);
		const exc = isExclude(p);

		let status;
		if (inc && exc) status = "conflict";
		else if (inc) status = "included";
		else if (exc) status = "excluded";
		else status = "unknown";

		result.set(p, status);
	}

	return result;
}

function buildTree(paths) {
	const tree = {};

	for (const p of paths) {
		const parts = p.split(path.sep);
		let node = tree;
		for (const part of parts) {
			node.children ||= {};
			node.children[part] ||= {};
			node = node.children[part];
		}
	}

	return tree;
}

function compressTree(tree, statuses, prefix = "") {
	const entries = [];

	for (const [name, node] of Object.entries(tree.children || {})) {
		const full = prefix ? path.join(prefix, name) : name;

		const childStatuses = [];
		for (const [p, s] of statuses) {
			if (p === full || p.startsWith(full + path.sep)) {
				childStatuses.push(s);
			}
		}

		const unique = new Set(childStatuses);

		if (unique.size === 1 && !node.children) {
			entries.push({ name, status: [...unique][0] });
		} else if (unique.size === 1) {
			entries.push({ name: name + "/", status: [...unique][0] });
		} else {
			entries.push({
				name: name + "/",
				children: compressTree(node, statuses, full)
			});
		}
	}

	return entries;
}

function printTree(entries, indent = "") {
	for (const e of entries) {
		if (e.status) {
			if (e.status !== "excluded") {
				console.log(`${indent}${e.name} (${e.status})`);
			}
		} else {
			console.log(`${indent}${e.name}`);
			printTree(e.children, indent + "  ");
		}
	}
}

function hasInvalid(statuses) {
	for (const s of statuses.values()) {
		if (s === "unknown" || s === "conflict") return true;
	}
	return false;
}

function copyIncluded(statuses) {
	for (const [p, s] of statuses) {
		if (s !== "included") continue;

		const src = path.join(SRC, p);
		const dest = path.join(DEST, p);

		fs.mkdirSync(path.dirname(dest), { recursive: true });

		if (fs.statSync(src).isFile()) {
			fs.copyFileSync(src, dest);
		}
	}
}

async function main() {
	while (true) {
		const { include, exclude } = loadPatterns();

		const all = walkAllFiles(SRC);
		const statuses = classify(all, include, exclude);

		const visible = [...statuses.entries()].filter(
			([, s]) => s === "included" || s === "unknown"
		);

		const tree = buildTree(visible.map(([p]) => p));
		const compressed = compressTree(tree, statuses);

		console.clear();
		printTree(compressed);

		if (hasInvalid(statuses)) {
			await new Promise(res =>
				rl.question(
					"\nResolve patterns (unknown/conflict present). Edit patterns.js, then press Enter.",
					res
				)
			);
			continue;
		}

		const answer = await new Promise(res =>
			rl.question("\nAll files resolved. Proceed with copy? (y/n) ", res)
		);

		if (answer.toLowerCase() === "y") {
			copyIncluded(statuses);
			console.log("Copy complete.");
		}

		break;
	}

	rl.close();
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
