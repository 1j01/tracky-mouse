const { dialog, shell, net, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const REPO = '1j01/tracky-mouse';
let API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

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

			const mockResponse = {
				url: `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
				html_url: `https://github.com/${owner}/${repo}/releases/tag/v9001.0.0`,
				tag_name: 'v9001.0.0',
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
function execGit(args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile('git', args, options, (error, stdout, stderr) => {
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
	await execGit(['-C', repoRoot, 'rev-parse', '--is-inside-work-tree']);
	return repoRoot;
}

async function pullTag(repoRoot, tagName) {
	await execGit(['-C', repoRoot, 'fetch', '--tags']);
	await execGit(['-C', repoRoot, 'checkout', tagName]);
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
					// TODO: get terminology straight
					// I wouldn't personally call it a "git checkout", I'd just say
					// a "git repo" or a "git clone". This is what the AI decided to call it.
					// It's not that it's inaccurate, but I only use it as a verb,
					// and it may be confusing since the verb action IS what we're doing here.
					// Also "pulling a tag" a colloquial term (that I used when prompting the AI),
					// but is it technically accurate?
					// Also, have to think about non-technical users who may have cloned the repo
					// out of necessity (to run on a platform without prebuilt binaries)
					// where "pull tag" may be meaningless. Maybe just "Update" or "Update from git".
					const buttons = repoRoot
						? ['Pull tag', 'Remind me later', 'Skip this version']
						: ['Download', 'Remind me later', 'Skip this version'];
					const { response: buttonIndex } = await dialog.showMessageBox({
						type: 'info',
						title: 'Update Available',
						message: `A new version of Tracky Mouse is available: ${latestVersion}\n\nYou are currently using version ${currentVersion}.` +
							(repoRoot ? '\n\nThis looks like a git checkout, so the update can be pulled directly.' : ''),
						buttons,
						defaultId: 0,
						cancelId: 1
					});

					if (buttonIndex === 0) {
						if (repoRoot) {
							try {
								// TODO: make sure there are no uncommitted changes
								await pullTag(repoRoot, latestVersion);
								await dialog.showMessageBox({
									type: 'info',
									title: 'Update Pulled',
									message: `Checked out ${latestVersion}. Restart the app to use the updated version.`
								});
								// TODO: maybe actually offer to restart the app
								// maybe ensure that the software restarts enabled if it's currently enabled
								// or mention whether it will end up active (depending on the setting)
							} catch (error) {
								// TODO: rename variable
								const { response: fallbackIndex } = await dialog.showMessageBox({
									type: 'error',
									title: 'Update Pull Failed',
									message: `Couldn't pull ${latestVersion} from git.\n\n${error.message}`,
									buttons: ['Open download page', 'Close'],
									defaultId: 0,
									cancelId: 1
								});
								if (fallbackIndex === 0) {
									// TODO: consider restructuring to deduplicate this
									shell.openExternal(release.html_url);
								}
							}
						} else {
							shell.openExternal(release.html_url);
						}
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
