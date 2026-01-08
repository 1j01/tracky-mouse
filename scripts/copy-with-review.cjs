#!/usr/bin/env node

/*
ChatGPT prompt:

"Node.js script to copy files between directories, using an include list and exclude list of globs. If something is matched by neither (unknown) or both (conflict), the script should wait for the user to change the patterns, and refresh the result interactively, prompting for confirmation to continue once it becomes valid. It should show a minimal tree view of included and unknown files/folders, without showing excluded files/folders or traversing into folders when the contents are all marked the same as the parent folder."
(+ followup prompt: "> Re-evaluates automatically on Enter
That's not automatic. It should watch the file.")

(+ added args parsing, and a --dry-run option, validation of the patterns file, emojis for readability, generally improved output)
(+ fixes: followSymbolicLinks: true, dot: true, onlyFiles: true, path.sep -> "/"*, exit on SIGINT (Ctrl+C) or when canceling (N), conflicts not showing in tree)
(*an AI agent did this one, I haven't audited it)

TODO:
- Clean up the code
  - Is a separate module fast-glob really needed just for walking the directory tree?
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
	console.error("Usage: node copy-with-review.cjs <src> <dest> <patterns.js> [--dry-run]");
	process.exit(1);
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// why is this needed? readline?
rl.on("SIGINT", () => {
	process.exit(0);
});

const statusToEmoji = {
	included: "✅",
	excluded: "❌",
	unknown: "❓",
	conflict: "⚠️"
};

let awaitingConfirmation = false;
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

function walkAll(root) {
	return fg.sync(["**/*"], {
		cwd: root,
		dot: true,
		onlyFiles: true,
		followSymbolicLinks: true
	});
}

function classify(paths, include, exclude) {
	const inc = picomatch(include, { dot: true });
	const exc = picomatch(exclude, { dot: true });


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
		const parts = p.split('/');
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
		const full = prefix ? prefix + "/" + name : name;

		const s = [];
		for (const [p, st] of statuses) {
			if (p === full || p.startsWith(full + "/")) {
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
				// console.log(`${indent}${e.name} (${e.status})`);
				const emoji = statusToEmoji[e.status] || `[UNKNOWN STATUS: ${e.status}]`;
				console.log(`${indent}${emoji} ${e.name}`);
			}
		} else {
			console.log(`${indent}📂 ${e.name}`);
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
			if (!DRY_RUN) {
				fs.copyFileSync(src, dst);
			} else {
				console.log(`[DRY RUN] Would copy ${src} to ${dst}`);
			}
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
		console.log("\nWaiting for patterns.js to become valid…");
		return;
	}

	const all = walkAll(SRC);
	const statuses = classify(all, patterns.include, patterns.exclude);

	const visible = [...statuses.entries()]
		.filter(([, s]) => s === "included" || s === "unknown" || s === "conflict")
		.map(([p]) => p);

	console.clear();
	console.log(`Source: ${SRC}`);
	console.log(`Destination: ${DEST}`);
	console.log(`Patterns file: ${PATTERN_FILE}`);
	console.log(`Dry run: ${DRY_RUN ? "Yes" : "No"}`);
	console.log("\nFiles to be copied:");
	const tree = buildTree(visible);
	const compressed = compress(tree, statuses);
	print(compressed);

	if (hasInvalid(statuses)) {
		awaitingConfirmation = false;
		// console.log("\nWaiting for patterns.js to become valid…");
		// console.log(`\nNot all files are sorted into excluded and included categories.\nWaiting for changes to ${path.basename(PATTERN_FILE)}…`);
		process.stdout.write(`\nNot all files are sorted into excluded and included categories.\nWaiting for changes to ${path.basename(PATTERN_FILE)}…`);
		return;
	}

	if (awaitingConfirmation) return;
	awaitingConfirmation = true;

	rl.question("\nAll files sorted. Proceed with copy? (y/n) ", ans => {
		if (ans.toLowerCase() === "y") {
			copy(statuses);
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
		debounceTimer = setTimeout(evaluate, 100);
	});
}

evaluate();
watchPatterns();
