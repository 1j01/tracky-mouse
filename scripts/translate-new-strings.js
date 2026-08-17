
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const localesFolder = path.join(__dirname, "..", "core", "locales");

const availableLanguages = fs.readdirSync(localesFolder).filter((name) => {
	return fs.existsSync(path.join(localesFolder, name, "translation.json"));
});
availableLanguages.sort((a, b) => a.localeCompare(b));

function runExtractCommand() {
	const extractCommand = "npx i18next-cli extract";
	const extractResult = child_process.spawnSync(extractCommand, {
		shell: true,
		cwd: path.join(__dirname, ".."),
		encoding: "utf8",
	});

	if (extractResult.error) {
		console.error(`Error running "${extractCommand}":`, extractResult.error);
		process.exit(1);
	}
}

if (process.argv.includes("--what-needs-translation")) {
	runExtractCommand();
}

const baseLanguage = "en";
const baseLocaleFile = path.join(localesFolder, baseLanguage, "translation.json");
const baseLocaleContent = JSON.parse(fs.readFileSync(baseLocaleFile, "utf8"));
const keysNeedingTranslation = Object.entries(baseLocaleContent)
	.filter(([_key, value]) => !value)
	.map(([key, _value]) => key);
const languagesNeedingTranslation = availableLanguages
	.filter(lang => lang !== baseLanguage);

if (process.argv.includes("--what-needs-translation")) {
	console.log(`
Languages: ${availableLanguages.join(", ")}
Keys needing translation:
${keysNeedingTranslation.map(key => `- ${key} (English: ${JSON.stringify(baseLocaleContent[key])})`).join("\n")}

Please write a JSON file named "new-translations.json" in the "scripts" folder with the following structure:
const newTranslations = {
	"newKey1": {
		"en": "New String 1",
		"es": "Nueva Cadena 1",
		"fr": "Nouvelle Chaîne 1",
		// ... other languages
	},
};


`);
} else if (process.argv.includes("--apply-translations")) {
	const newTranslations = require("./new-translations.json");

	for (const key of Object.keys(newTranslations)) {
		if (!keysNeedingTranslation.includes(key)) {
			console.warn(`Warning: Key "${key}" not expected in new-translations.json.`);
		}
	}
	for (const key of keysNeedingTranslation) {
		if (!Object.hasOwn(newTranslations, key)) {
			console.warn(`Warning: Key "${key}" needs translation but is missing in new-translations.json.`);
		} else if (!languagesNeedingTranslation.every(lang => Object.hasOwn(newTranslations[key], lang))) {
			console.warn(`Warning: Key "${key}" does not have translations for all languages needing translation.`);
		}
	}

	Object.keys(newTranslations).forEach(key => {
		const translations = newTranslations[key];
		Object.keys(translations).forEach(lang => {
			const filePath = path.join(localesFolder, lang, 'translation.json');
			const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			fileContent[key] = translations[lang];
			fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
		});
	});

	// Run the extract command again to reorder the keys in the translation files
	runExtractCommand();

} else {
	console.error("Please specify either --what-needs-translation or --apply-translations.");
	process.exit(1);
}
