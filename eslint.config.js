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
				"tab"
			],
			// "quotes": [
			// 	"error",
			// 	"single"
			// ],
			"semi": [
				"error",
				"always"
			]
		},
	},
	{
		"files": [
			"desktop-app/src/electron-main.js",
			"desktop-app/src/preload-main.js",
			"desktop-app/src/preload-screen-overlay.js",
			"desktop-app/forge.config.js",
			"eslint.config.js",
		],
		"languageOptions": {
			"globals": {
				// ...globals.commonjs,
				...globals.node
			},
			"sourceType": "commonjs"
		},
	}
];
