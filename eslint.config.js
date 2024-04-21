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
				...globals.commonjs,
				...globals.es2021,
				...globals.node
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
];
