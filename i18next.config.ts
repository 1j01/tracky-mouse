import { defineConfig } from 'i18next-cli';

export default defineConfig({
	locales: [
		"en",
		"es",
		"de",
		"it",
	],
	extract: {
		input: "{core,desktop-app}/**/*.{js,jsx,ts,tsx}",
		ignore: [
			"**/node_modules/**",
			"**/lib/**",
			"**/out/**",
			"**/dist/**",
			"**/build/**",
			"**/private/**",
			"**/electron-main.js", // uses top-level return
		],
		output: "core/locales/{{language}}/{{namespace}}.json",
		nsSeparator: false,
		keySeparator: false,
	},
});