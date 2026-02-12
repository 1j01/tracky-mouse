const { dialog, shell, net, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const REPO = '1j01/tracky-mouse';
let API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

// NOTE TO SELF: If you're expecting to see the update dialog,
// make sure "General > Check for updates" IS ENABLED!
const TEST_UPDATE_CHECKING = process.env.TEST_UPDATE_CHECKING === 'true';

if (TEST_UPDATE_CHECKING) {
	const http = require('http');
	const url = require('url');

	const PORT = 64207;

	const server = http.createServer((req, res) => {
		const parsedUrl = url.parse(req.url, true);
		const path = parsedUrl.pathname;

		// Match: /repos/{owner}/{repo}/releases/latest
		const match = path.match(/^\/repos\/([^/]+)\/([^/]+)\/releases\/latest$/);

		if (req.method === 'GET' && match) {
			const owner = match[1];
			const repo = match[2];

			// Don't include v prefix so that it doesn't trigger a
			// GitHub Actions workflow if a tag with this name is pushed.
			// This allows for testing of the git repo update logic
			// by manually pushing a tag to the repo from another computer.
			// (and not fetching on the test computer, since that should be part of the tested logic)
			// We _could_ fully avoid github for testing by adding
			// a remote that points to a local git repo.
			const fakeReleaseTagName = '9001-fake-release';

			const mockResponse = {
				url: `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
				html_url: `https://github.com/${owner}/${repo}/releases/tag/${fakeReleaseTagName}`,
				tag_name: fakeReleaseTagName,
				name: 'Mock Release v9001.0.0',
				draft: false,
				prerelease: false,
				published_at: new Date().toISOString(),
				body: 'This is a mocked GitHub release response.',
				assets: [
					{
						name: `${repo}-v9001.0.0.zip`,
						browser_download_url: `https://example.com/${repo}-v9001.0.0.zip`,
						size: 123456
					}
				]
			};

			res.writeHead(200, {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache',
			});
			res.end(JSON.stringify(mockResponse, null, 2));
			return;
		}

		// Fallback for unknown routes
		res.writeHead(418, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ message: 'Unexpected route. I can only brew tea.' }));
	});

	server.listen(PORT, () => {
		console.log(`Mock GitHub API running at http://localhost:${PORT}`);
	});

	API_URL = `http://localhost:${PORT}/repos/${REPO}/releases/latest`;
}

function parseVersion(versionString) {
	versionString = versionString.replace(/^v/, '');
	// Removes anything after a hyphen (prerelease info)
	// TODO: handle prerelease versions properly (maybe skip them?)
	const parts = versionString.split('-')[0].split('.').map(Number);
	return parts;
}

function isNewer(current, latest) {
	const currentParts = parseVersion(current);
	const latestParts = parseVersion(latest);

	for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
		const c = currentParts[i] || 0;
		const l = latestParts[i] || 0;
		if (l > c) return true;
		if (l < c) return false;
	}
	return false;
}

// ---------
// AI GENERATED CODE
// may be overly complex
function exec(program, args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile(program, args, options, (error, stdout, stderr) => {
			if (error) {
				const details = stderr || stdout || error.message;
				reject(new Error(details));
				return;
			}
			resolve(stdout.trim());
		});
	});
}

function findGitRoot(startDir) {
	let currentDir = startDir;
	while (currentDir && currentDir !== path.parse(currentDir).root) {
		const gitPath = path.join(currentDir, '.git');
		if (fs.existsSync(gitPath)) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}
	return null;
}

async function getGitRepoRoot() {
	const startDir = app.getAppPath();
	const repoRoot = findGitRoot(startDir);
	if (!repoRoot) {
		return null;
	}
	await exec('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree']);
	return repoRoot;
}
// ---------

module.exports = {
	checkForUpdates: ({ currentVersion, skippedVersion, pleaseSkipThisVersion }) => {
		const request = net.request(API_URL);
		request.on('response', (response) => {
			let body = '';
			response.on('data', (chunk) => {
				body += chunk;
			});
			response.on('end', async () => {
				if (response.statusCode !== 200) {
					console.error('Failed to check for app updates:', response.statusCode, body);
					return;
				}

				let release;
				try {
					release = JSON.parse(body);
				} catch (e) {
					console.error('Error parsing app update GitHub API response:', e);
				}
				const latestVersion = release.tag_name;
				if (typeof release.html_url !== 'string' || release.html_url.match(/^https?:\/\/.+/i) === null) {
					console.error('Invalid release URL in GitHub API response:', release.html_url);
					return;
				}

				if (isNewer(currentVersion, latestVersion)) {
					if (skippedVersion === latestVersion) {
						// User decided to skip this version
						return;
					}

					let repoRoot = null;
					try {
						repoRoot = await getGitRepoRoot();
					} catch (error) {
						console.warn('Unable to detect git repo for update pull:', error);
					}

					// TODO: show release notes (release.body is in markdown format)

					// Wording options: "Update Git Repo", "Update via Git", "Update from Git", or just "Update"?
					// (formerly "Pull Tag")
					const buttons = repoRoot
						? ['Update from Git', 'Remind me later', 'Skip this version']
						: ['Download', 'Remind me later', 'Skip this version'];
					const { response: buttonIndex } = await dialog.showMessageBox({
						type: 'info',
						title: 'Update Available',
						message: `A new version of Tracky Mouse is available: ${latestVersion}\n\nYou are currently using version ${currentVersion}.` +
							(repoRoot ? '\n\nSince this is a git repository, the update can be pulled directly.' : ''),
						buttons,
						defaultId: 0,
						cancelId: 1
					});

					if (buttonIndex === 0) {
						if (repoRoot) {
							// TODO: make sure there are no uncommitted changes
							let step = "fetch";
							try {
								await exec('git', ['-C', repoRoot, 'fetch', '--tags']);
								step = "checkout";
								await exec('git', ['-C', repoRoot, 'checkout', latestVersion]);
								step = "install";
								await exec('npm', ['install'], { cwd: path.join(repoRoot, "desktop-app") });

								const { response: restartChoice } = await dialog.showMessageBox({
									type: 'info',
									title: 'Update Successful',
									message: `Checked out ${latestVersion}. Restart the app to use the updated version.`,
									buttons: ['Restart Now', 'Later'],
									defaultId: 0,
									cancelId: 1
								});
								if (restartChoice === 0) {
									// TODO: maybe ensure that the software restarts enabled if it's currently enabled
									// or mention whether it will end up active (depending on the setting)
									app.relaunch();
									app.exit(0);
								}
								return;
							} catch (error) {
								const friendlyMessage = {
									fetch: "Couldn't fetch updates from git.",
									checkout: "Couldn't checkout the latest version in the local git repository. You may have uncommitted changes.",
									install: "Failed to install dependencies for the new version after checking it out from git."
								}[step] ?? "An error occurred while updating from git.";
								const { response: fallbackButtonIndex } = await dialog.showMessageBox({
									type: 'error',
									title: 'Update Failed',
									message: `${friendlyMessage}\n\n${error.message}`,
									buttons: ['Open download page', 'Close'],
									defaultId: 0,
									cancelId: 1
								});
								if (fallbackButtonIndex !== 0) {
									return;
								}
							}
						}
						shell.openExternal(release.html_url);
					} else if (buttonIndex === 2) {
						pleaseSkipThisVersion(latestVersion);
					}
				}
			});
		});
		request.on('error', (error) => {
			console.error('Network error checking for app updates:', error);
		});
		request.end();
	}
};
