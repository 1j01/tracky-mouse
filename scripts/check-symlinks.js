// Detects a checkout made without symlink support (Windows) and offers to fix it.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const readline = require("readline");

const root = path.resolve(__dirname, "..");
const symlinkPaths = ["website/core", "website/images"];

function isBroken(rel) {
	const full = path.join(root, rel);
	try {
		return !fs.lstatSync(full).isSymbolicLink();
	} catch (_error) {
		return false; // missing, e.g. not a git checkout
	}
}

function git(...args) {
	return execFileSync("git", args, { cwd: root, stdio: "pipe" }).toString().trim();
}

function ask(question) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => rl.question(question, (answer) => {
		rl.close();
		resolve(/^y/i.test(answer.trim()));
	}));
}

async function main() {
	if (process.platform !== "win32") return;
	const broken = symlinkPaths.filter(isBroken);
	if (broken.length === 0) return;

	console.warn(`\nThese should be symbolic links, but were checked out as regular files/folders:\n  ${broken.join("\n  ")}`);
	console.warn("This happens when git's core.symlinks setting is off, which is the default on Windows without Developer Mode.");

	if (!process.stdin.isTTY) {
		console.warn("Enable Developer Mode in Windows, run `git config core.symlinks true`, then re-checkout those paths.");
		return;
	}
	console.warn("Fixing requires Developer Mode enabled in Windows settings (or an administrator terminal).");
	if (!await ask("Set core.symlinks=true for this repo and re-checkout the links? [y/N] ")) return;

	try {
		git("config", "core.symlinks", "true");
		for (const rel of broken) {
			fs.rmSync(path.join(root, rel), { recursive: true, force: true });
		}
		git("checkout", "--", ...broken);
	} catch (error) {
		console.error("Automatic fix failed:", error.stderr ? error.stderr.toString() : error.message);
		console.error("Enable Developer Mode (or run as administrator), then run: node scripts/check-symlinks.js");
		process.exitCode = 1;
		return;
	}
	const stillBroken = symlinkPaths.filter(isBroken);
	if (stillBroken.length) {
		console.error("Still not symlinks:", stillBroken.join(", "), "- enable Developer Mode and try again.");
		process.exitCode = 1;
	} else {
		console.log("Symlinks restored.");
	}
}

main();
