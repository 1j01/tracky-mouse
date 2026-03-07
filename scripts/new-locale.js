const fs = require("fs");
const path = require("path");

const newLang = process.argv[2];

if (!newLang) {
	console.error("Usage: npm run new-locale -- <lang>");
	process.exit(1);
}

const localesFolder = path.join(__dirname, "..", "core", "locales");
const sourceFile = path.join(localesFolder, "en", "translation.json");
const targetFolder = path.join(localesFolder, newLang);
const targetFile = path.join(targetFolder, "translation.json");

if (!fs.existsSync(sourceFile)) {
	console.error(`Source translation file not found: ${sourceFile}`);
	process.exit(1);
}

fs.mkdirSync(targetFolder, { recursive: true });
fs.copyFileSync(sourceFile, targetFile);
console.log(`Created locale '${newLang}' at ${targetFile}`);

try {
	require(path.join(__dirname, "update-locales.js"));
} catch (error) {
	console.error("Failed to update locale metadata:", error);
	process.exit(1);
}
