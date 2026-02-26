const globals = require("globals");
const js = require("@eslint/js");

/** @type {import('@types/eslint').Linter.FlatConfig[]} */
module.exports = [
	{
		"ignores": [
			"**/node_modules",
			"**/out",
			"**/dist",
			"**/lib",
			"**/.*",
		],
	},
	js.configs.recommended,
	{
		"languageOptions": {
			"globals": {
				...globals.browser,
				// ...globals.es2021,
			},
			"ecmaVersion": "latest"
		},
		"rules": {
			"indent": [
				"error",
				"tab",
				{ "SwitchCase": 1 }
			],
			// "quotes": [
			// 	"error",
			// 	"single"
			// ],
			"semi": [
				"error",
				"always"
			],
			// "no-unused-vars": "off",
			// "@typescript-eslint/no-unused-vars": [
			// 	"warn", // or "error"
			// 	{
			// 		"argsIgnorePattern": "^_",
			// 		"varsIgnorePattern": "^_",
			// 		"caughtErrorsIgnorePattern": "^_"
			// 	}
			// ]
			"no-unused-vars": ["warn", {
				"args": "all",
				"argsIgnorePattern": "^_",
				"caughtErrorsIgnorePattern": "^_",
				// "varsIgnorePattern": "^_",
			}],
		},
	},
	{
		"files": [
			"desktop-app/src/tracky-mouse-bin.js",
			"desktop-app/src/electron-main/*",
			"desktop-app/src/preload-app-window.js",
			"desktop-app/src/preload-screen-overlay.js",
			"desktop-app/forge.config.js",
			"scripts/copy-with-review.js",
			"scripts/list-ipc-events.js",
			"scripts/update-cli-docs.js",
			"scripts/update-locales.js",
			"scripts/release/update-msix-package-version.js",
			"scripts/release/update-dl-links.js",
			"scripts/release/bump-changelog.js",
			"scripts/release/extract-changelog.js",
			"scripts/release/release.js",
			"website/globs-for-deploy.js",
			"eslint.config.js",
		],
		"languageOptions": {
			"globals": {
				// ...globals.commonjs,
				...globals.node
			},
			"sourceType": "commonjs"
		},
	},
	{
		"files": [
			"desktop-app/src/electron-main/electron-main.js",
		],
		"rules": {
			"id-denylist": ["error",
				// Disallow translation function because i18next-cli extract can't parse this file due to top-level return.
				"t"
			],
		},
	}
];
