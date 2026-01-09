#!/usr/bin/env node

/*
Script to copy files between directories, using an include list and exclude list of globs.
If something is matched by neither (unknown) or both (conflict), the script waits
for the user to change the patterns, and refreshes automatically,
prompting for confirmation to proceed with copying once it becomes valid.
It shows a tree view of included, unknown, and conflicted files, hiding excluded files/folders.

TODO:
- Clean up the code
  - Multiple tree representations (with/without status - compressTree converts from one to the other)
  - Awkward main orchestration relying heavily on process.exit
- Refresh output in-place and avoid the user scrolling up to earlier, outdated output,
  perhaps by using the alternate screen buffer, making it more of a TUI application
- Handle copying empty directories (if this is to be a reusable tool)
- Don't prompt if everything matches initially (optionally, if this is to be a reusable tool)
- Show exact globs that are causing conflicts, with clickable "file line:col" links (in supported IDEs)
- Help debug non-matching globs
- Require review for any patterns that don't match anything, unless marked specially,
  or at least for include patterns. Or I guess, really, the problem to solve there is
  "files in one deploy that are missing in the next", in which case the solution
  might involve storing the files previously included in a deploy? But you'd still want
  to be able to have some notion of files that can exist or not, that don't require review.
- --help option
*/

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const picomatch = require("picomatch");
const readline = require("readline");

// Get arguments
const SRC = path.resolve(process.argv[2]);
const DEST = path.resolve(process.argv[3]);
const PATTERN_FILE = path.resolve(process.argv[4]);
const DRY_RUN = process.argv.includes("--dry-run");
if (!SRC || !DEST || !PATTERN_FILE) {
	console.error("Usage: node copy-with-review.js <src> <dest> <patterns.js> [--dry-run]");
	process.exit(1);
}
if (!fs.existsSync(PATTERN_FILE)) {
	console.error(`Patterns file does not exist at ${PATTERN_FILE}`);
	process.exit(1);
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// why is this needed? readline blocks Ctrl+C from exiting the process
rl.on("SIGINT", () => {
	process.exit(0);
});

const statusToEmoji = {
	included: "✅",
	excluded: "❌",
	unknown: "❓",
	conflict: "⚠️"
};

let confirmationAbortController = null;
let debounceTimer = null;

function loadPatterns() {
	delete require.cache[require.resolve(PATTERN_FILE)];
	const patterns = require(PATTERN_FILE);
	if (!patterns.include || !patterns.exclude) {
		throw new Error("Patterns file must export an object with 'include' and 'exclude' arrays.");
	}
	if (!Array.isArray(patterns.include) || !Array.isArray(patterns.exclude)) {
		throw new Error("'include' and 'exclude' must be arrays.");
	}
	return patterns;
}

function scanDirectoryTree(root) {
	return fg.sync(["**/*"], {
		cwd: root,
		dot: true,
		onlyFiles: true,
		followSymbolicLinks: true
	});
}

function classifyPaths(paths, includePatterns, excludePatterns) {
	const isIncluded = picomatch(includePatterns, { dot: true });
	const isExcluded = picomatch(excludePatterns, { dot: true });

	const statusMap = new Map();

	for (const filePath of paths) {
		const included = isIncluded(filePath);
		const excluded = isExcluded(filePath);
		const status =
			included && excluded ? "conflict" :
				included ? "included" :
					excluded ? "excluded" :
						"unknown";
		statusMap.set(filePath, status);
	}

	return statusMap;
}

function buildTree(paths) {
	const root = {};
	for (const filePath of paths) {
		const parts = filePath.split('/');
		// Start at root and traverse down the tree, creating nodes as needed
		let node = root;
		for (const part of parts) {
			node.children ||= {};
			node.children[part] ||= {};
			node = node.children[part];
		}
	}
	return root;
}

function compressTree(tree, statusMap, prefix = "") {
	const compressedNodes = [];

	for (const [name, node] of Object.entries(tree.children || {})) {
		const fullPath = prefix ? prefix + "/" + name : name;

		// Find all statuses for files under this node
		const statusesInSubtree = new Set();
		for (const [filePath, status] of statusMap) {
			if (filePath === fullPath || filePath.startsWith(fullPath + "/")) {
				statusesInSubtree.add(status);
			}
		}

		// If all files in this subtree have the same status, collapse it
		if (statusesInSubtree.size === 1) {
			compressedNodes.push({
				name: node.children ? name + "/" : name,
				status: [...statusesInSubtree][0]
			});
		} else {
			compressedNodes.push({
				name: name + "/",
				children: compressTree(node, statusMap, fullPath)
			});
		}
	}

	return compressedNodes;
}

function printTree(nodes, indent = "") {
	for (const node of nodes) {
		if (node.status) {
			if (node.status !== "excluded") {
				const emoji = statusToEmoji[node.status] || `[UNKNOWN STATUS: ${node.status}]`;
				console.log(`${indent}${emoji} ${node.name}`);
			}
		} else {
			console.log(`${indent}📂 ${node.name}`);
			printTree(node.children, indent + "  ");
		}
	}
}

function anyProblems(statusMap) {
	for (const status of statusMap.values()) {
		if (status === "unknown" || status === "conflict") return true;
	}
	return false;
}

function copyFiles(statusMap) {
	for (const [filePath, status] of statusMap) {
		if (status !== "included") continue;

		const srcPath = path.join(SRC, filePath);
		const dstPath = path.join(DEST, filePath);

		fs.mkdirSync(path.dirname(dstPath), { recursive: true });
		if (fs.statSync(srcPath).isFile()) {
			if (!DRY_RUN) {
				fs.copyFileSync(srcPath, dstPath);
			} else {
				console.log(`[DRY RUN] Would copy ${srcPath} to ${dstPath}`);
			}
		}
	}
}

function validateAndMaybePromptToCopy() {
	if (confirmationAbortController) {
		confirmationAbortController.abort();
		confirmationAbortController = null;
	}

	let patterns;
	try {
		patterns = loadPatterns();
	} catch (e) {
		console.clear();
		console.log(`Failed to load patterns file ${path.basename(PATTERN_FILE)}`);
		console.log(e.message);
		process.stdout.write(`\nWaiting for ${path.basename(PATTERN_FILE)} to become valid…`);
		return;
	}

	const allFiles = scanDirectoryTree(SRC);
	const statusMap = classifyPaths(allFiles, patterns.include, patterns.exclude);

	const visibleFiles = [...statusMap.entries()]
		.filter(([, status]) => status === "included" || status === "unknown" || status === "conflict")
		.map(([filePath]) => filePath);

	console.clear();
	console.log(`Source: ${SRC}`);
	console.log(`Destination: ${DEST}`);
	console.log(`Patterns file: ${PATTERN_FILE}`);
	console.log(`Dry run: ${DRY_RUN ? "Yes" : "No"}`);
	console.log("\nFiles to be copied:");
	const tree = buildTree(visibleFiles);
	const compressedTree = compressTree(tree, statusMap);
	printTree(compressedTree);

	if (anyProblems(statusMap)) {
		process.stdout.write(`\nNot all files are sorted into excluded and included categories.\nWaiting for changes to ${path.basename(PATTERN_FILE)}…`);
		return;
	}

	confirmationAbortController = new AbortController();
	rl.question("\nAll files sorted. Proceed with copy? (Y/n) ", { signal: confirmationAbortController.signal }, ans => {
		if (!ans.toLowerCase().startsWith("n")) {
			copyFiles(statusMap);
			console.log("Copy complete.");
			process.exit(0);
		} else {
			console.log("Aborted.");
			process.exit(1);
		}
	});
}

function watchPatterns() {
	fs.watch(PATTERN_FILE, () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(validateAndMaybePromptToCopy, 100);
	});
}

validateAndMaybePromptToCopy();
watchPatterns();
