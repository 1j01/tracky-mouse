const fs = require('fs');
const path = require('path');

const version = process.env.VERSION;
const date = process.env.DATE || new Date().toISOString().split('T')[0];

if (!version) {
	console.error('VERSION env var is not set');
	console.error('Usage: VERSION=x.y.z node scripts/bump-changelog.js');
	process.exit(1);
}

if (version !== require('../package.json').version) {
	console.error('VERSION env var does not match package.json version');
	console.error(`Expected: ${version}, Got: ${require('../package.json').version}`);
	process.exit(1);
}

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');

// Check if there's content under Unreleased
const unreleasedMatch = changelog.match(/## \[Unreleased\]\s+([\s\S]*?)(?=\n## \[|$)/);
if (!unreleasedMatch) {
	console.error('Could not find [Unreleased] section in CHANGELOG.md');
	process.exit(1);
}

const unreleasedContent = unreleasedMatch[1].trim();
if (!unreleasedContent || unreleasedContent.length < 10) {
	console.error('No significant content found under [Unreleased] section');
	process.exit(1);
}

// Replace [Unreleased] with new version and date
const newUnreleasedSection = `## [Unreleased]

### Changed


### Added


### Fixed


`;

const versionedSection = `## [${version}] - ${date}`;

let updatedChangelog = changelog.replace(
	/## \[Unreleased\]/,
	newUnreleasedSection + versionedSection
);

// Update the comparison links at the bottom
const oldVersionMatch = changelog.match(/\[Unreleased\]: https:\/\/github\.com\/1j01\/tracky-mouse\/compare\/v([^.]+\.[^.]+\.[^.]+)\.\.\.HEAD/);
if (oldVersionMatch) {
	const previousVersion = oldVersionMatch[1];
	updatedChangelog = updatedChangelog.replace(
		/\[Unreleased\]: https:\/\/github\.com\/1j01\/tracky-mouse\/compare\/v[^.]+\.[^.]+\.[^.]+\.\.\.HEAD/,
		`[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v${version}...HEAD\n[${version}]: https://github.com/1j01/tracky-mouse/compare/v${previousVersion}...v${version}`
	);
}

fs.writeFileSync(changelogPath, updatedChangelog);
console.log(`Successfully bumped CHANGELOG.md to version ${version} (${date})`);
