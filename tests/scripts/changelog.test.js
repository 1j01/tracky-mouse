import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { join } from 'path';

const projectRoot = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

// These tests exercise the regex logic used by the release scripts
// without spawning subprocesses that would modify project files.

describe('extract-changelog regex', () => {
	// Matches the regex used in scripts/release/extract-changelog.js
	const regex = /^##\s*\[([^\]]+)\]\s-\s\d+-\d+-\d+[\r\n]+((?:^(?!##\s).*$[\r\n]?)*)/m;

	const sampleChangelog = `# Changelog

## [Unreleased]

No changes here yet.

## [1.2.3] - 2025-06-01

### Added

- New feature A.
- New feature B.

## [1.2.2] - 2025-01-01

- Previous release.
`;

	it('extracts the version number from the first released section', () => {
		const match = sampleChangelog.match(regex);
		expect(match).not.toBeNull();
		expect(match[1].trim()).toBe('1.2.3');
	});

	it('extracts the body text of the first released section', () => {
		const match = sampleChangelog.match(regex);
		expect(match[2]).toContain('New feature A.');
		expect(match[2]).toContain('New feature B.');
	});

	it('does not include the next version section in the body', () => {
		const match = sampleChangelog.match(regex);
		expect(match[2]).not.toContain('Previous release.');
	});

	it('returns null when there is no released version section', () => {
		const noRelease = '# Changelog\n\n## [Unreleased]\n\nSome work.\n';
		const match = noRelease.match(regex);
		expect(match).toBeNull();
	});
});

describe('bump-changelog regex logic', () => {
	// Matches the regex used in scripts/release/bump-changelog.js
	const unreleasedRegex = /## \[Unreleased\]\s+([\s\S]*?)(?=\n## \[|$)/;

	const changelogWithContent = `# Changelog

## [Unreleased]

- Added something useful.

## [1.0.0] - 2024-01-01

- Initial release.
`;

	const changelogEmpty = `# Changelog

## [Unreleased]

No changes here yet.

## [1.0.0] - 2024-01-01

- Initial release.
`;

	it('finds the Unreleased section when it has content', () => {
		const match = changelogWithContent.match(unreleasedRegex);
		expect(match).not.toBeNull();
		expect(match[1].trim()).toContain('Added something useful.');
	});

	it('finds the Unreleased section when it has placeholder text', () => {
		const match = changelogEmpty.match(unreleasedRegex);
		expect(match).not.toBeNull();
		expect(match[1].trim()).toBe('No changes here yet.');
	});

	it('correctly bumps the changelog text', () => {
		const version = '1.1.0';
		const date = '2025-06-01';
		const newUnreleasedSection = `## [Unreleased]\n\nNo changes here yet.\n\n`;
		const versionedSection = `## [${version}] - ${date}`;
		const updated = changelogWithContent.replace(
			/## \[Unreleased\]/,
			newUnreleasedSection + versionedSection
		);
		expect(updated).toContain(`## [${version}] - ${date}`);
		expect(updated).toContain('No changes here yet.');
		expect(updated).toContain('Added something useful.');
	});

	it('updates comparison links correctly', () => {
		const changelog = `# Changelog

## [Unreleased]

- Change.

[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/1j01/tracky-mouse/compare/v0.9.0...v1.0.0
`;
		const version = '1.1.0';
		const oldVersionMatch = changelog.match(
			/\[Unreleased\]: https:\/\/github\.com\/1j01\/tracky-mouse\/compare\/v([^.]+\.[^.]+\.[^.]+)\.\.\.HEAD/
		);
		expect(oldVersionMatch).not.toBeNull();
		const previousVersion = oldVersionMatch[1];
		expect(previousVersion).toBe('1.0.0');

		const updated = changelog.replace(
			/\[Unreleased\]: https:\/\/github\.com\/1j01\/tracky-mouse\/compare\/v[^.]+\.[^.]+\.[^.]+\.\.\.HEAD/,
			`[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v${version}...HEAD\n[${version}]: https://github.com/1j01/tracky-mouse/compare/v${previousVersion}...v${version}`
		);
		expect(updated).toContain(`[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v${version}...HEAD`);
		expect(updated).toContain(`[${version}]: https://github.com/1j01/tracky-mouse/compare/v${previousVersion}...v${version}`);
	});
});

describe('extract-changelog.js script', () => {
	it('exits 0 and produces GitHub Actions output format on the real changelog', () => {
		const result = spawnSync(process.execPath, [join(projectRoot, 'scripts/release/extract-changelog.js')], {
			cwd: projectRoot,
			encoding: 'utf8',
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('changelog<<EndOfStringDelimiter');
		expect(result.stdout).toContain('EndOfStringDelimiter');
	});
});

describe('bump-changelog.js script', () => {
	it('exits 1 with a helpful message when VERSION is not set', () => {
		const { env } = process;
		const result = spawnSync(process.execPath, [join(projectRoot, 'scripts/release/bump-changelog.js')], {
			cwd: projectRoot,
			env: { ...env, VERSION: '' },
			encoding: 'utf8',
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('VERSION');
	});

	it('exits 1 with a helpful message when VERSION mismatches package.json', () => {
		const result = spawnSync(process.execPath, [join(projectRoot, 'scripts/release/bump-changelog.js')], {
			cwd: projectRoot,
			env: { ...process.env, VERSION: '0.0.0-invalid' },
			encoding: 'utf8',
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('package.json');
	});
});
