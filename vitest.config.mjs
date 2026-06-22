import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Use jsdom for tests under tests/core/
		environmentMatchGlobs: [
			['tests/core/**', 'jsdom'],
		],
		// Run before every test file (guarded by environment inside the file)
		setupFiles: ['./tests/setup.js'],
	},
});
