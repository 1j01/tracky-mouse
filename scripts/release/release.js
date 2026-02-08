const { execSync } = require("child_process");
// const fs = require("fs");
const path = require("path");

// async function run(command) {
// 	console.log(`Running command: ${command}`);
// 	const [prog, ...args] = command.split(" ");
// 	console.log(JSON.stringify({ prog, args }));
// 	const child = spawn(prog, args);
// 	child.stdout.pipe(process.stdout);
// 	child.stderr.pipe(process.stderr);
// 	child.on('close', (code) => {
// 		console.log(`child process exited with code ${code}`);
// 	});
// }

const repoRoot = path.join(__dirname, '../..');

function run(command) {
	return execSync(command, { stdio: 'inherit', cwd: repoRoot, env: process.env });
}
function getOutput(command) {
	return execSync(command, { stdio: 'pipe', cwd: repoRoot, env: process.env }).toString();
}

async function release() {
	const version = (process.argv[2] ?? "").trim().replace(/^v/, "");

	// Sanity check version numbers
	if (!version) {
		console.error('VERSION argument is not set');
		console.error('Usage: npm run release -- <version>');
		process.exit(1);
	}
	if (!/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version)) {
		console.error("Invalid version format");
		process.exit(1);
	}
	// TODO: check that `version` is greater?
	if (version === require('../../package.json').version) {
		console.error(`VERSION argument matches package.json version (${version})`);
		console.error("Please reset to a clean state in case the release was interrupted, and otherwise, make sure to increment the version.");
		process.exit(1);
	}

	// Check that GITHUB_TOKEN is configured
	// (it may be expired though)
	// This is no longer needed because the GitHub Actions workflow handles creating the release draft
	// if (!fs.existsSync(path.join(repoRoot, "desktop-app/.env"))) {
	// 	console.error("desktop-app/.env must be created defining a GITHUB_TOKEN");
	// 	process.exit(1);
	// }

	// Check working directory is clean
	if (getOutput("git status -u --porcelain").trim()) {
		console.error("Working directory is not clean.");
		process.exit(1);
	}

	// Check branch is main
	if (getOutput("git branch --show-current").trim() !== "main") {
		console.error("Current branch is not main.");
		process.exit(1);
	}

	// Run quality assurance checks:
	run("npm run lint");

	// TODO: try/catch with git reset --hard for the rest of the script to make it atomic?

	// Update CLI docs:
	require("../update-cli-docs.js");

	// Bump package versions.
	// TODO: bump also package-lock.json version numbers that reference other packages within the monorepo?
	// btw, this could be more DRY if the monorepo was handled in the same loop
	// (maybe not using the in-* scripts; though I COULD add an in-monorepo script JUST to make this loop clean)
	for (const package of ["core", "website", "desktop-app"]) {
		run(`npm run in-${package} -- npm version ${version} --no-git-tag-version`);
	}
	run(`npm version ${version} --no-git-tag-version`);

	// Some of these sub-scripts check package.json version
	// and they must see the updated version number to proceed.
	delete require.cache[require.resolve("../../package.json")];

	// Update version numbers and links in the changelog.
	process.env.VERSION = version;
	require("./bump-changelog.js");

	// Update download links to point to the new version:
	process.env.VERSION = version;
	require("./update-dl-links.js");

	// Update version number in MSIX package manifest:
	process.env.VERSION = version;
	require("./update-msix-package-version.js");

	// That's all the changes for the commit.
	// Add them before the lengthy build process in case one gets tempted to edit files while it's building
	run("git add .");

	// Build the desktop app (this is redundant with the publish step)
	// run("npm run in-desktop-app -- npm run make");

	// Create a GitHub release draft, automatically uploading the desktop app distributable files:
	// This is the step where you need an up-to-date access token,
	// so prompt to retry in a loop.
	// THIS NOW RUNS ON GITHUB ACTIONS
	// let needsPublish = true;
	// while (needsPublish) {
	// 	try {
	// 		run("npm run in-desktop-app -- npm run publish");
	// 		needsPublish = false;
	// 	} catch (error) {
	// 		console.error(error);
	// 		console.error("Failed to publish desktop app. Please check the error output above (you may need to regenerate and replace your GITHUB_TOKEN in desktop-app/.env) and try again.");
	// 		await new Promise((resolve) => {
	// 			const rl = require("readline").createInterface({
	// 				input: process.stdin,
	// 				output: process.stdout
	// 			});
	// 			rl.question("Press Enter to retry...", () => {
	// 				rl.close();
	// 				resolve();
	// 			});
	// 		});
	// 	}
	// }

	// Then commit the changes, tag the commit, and push the tag:
	run(`git commit -m "Release ${version}"`);
	run(`git tag v${version}`);
	// run("git push"); // deferred so the release can be tested first
	run(`git push origin tag v${version}`);

	// Pushing the tag should trigger a GitHub Actions workflow
	// which builds the app for all platforms and creates a release draft,
	// including release notes from the changelog.

	// Publish the library to npm:
	run("npm run in-core -- npm publish --dry-run");
	// TODO: instead of asking "does it look right?" keep a history of what files are included
	// (and sizes) and show if it's changed (significantly)
	console.log(`The above is a dry run of npm publish. Does it look right?
Please install via the GitHub release draft and test the installed desktop app.
If everything looks good, proceed with publishing:

git push
npm run in-website -- npm run deploy

and hit Publish on the GitHub release.
This should trigger a GitHub Actions workflow which publishes the core package to npm.
`);
}
release();
