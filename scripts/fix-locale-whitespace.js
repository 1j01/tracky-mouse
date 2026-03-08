const fs = require("fs");
const path = require("path");

const localesRoot = path.join(__dirname, "..", "core", "locales");

/**
 * Returns true if the string has leading or trailing whitespace.
 * @param {string} str
 */
function hasOuterWhitespace(str) {
	return typeof str === "string" && (/^\s/.test(str) || /\s$/.test(str));
}

/**
 * Describe the kinds of outer whitespace on a string for logging.
 * @param {string} str
 */
function describeOuterWhitespace(str) {
	if (typeof str !== "string") return "(non-string)";
	const parts = [];
	if (/^\s/.test(str)) {
		parts.push("leading");
	}
	if (/\s$/.test(str)) {
		parts.push("trailing");
	}
	if (!parts.length) return "none";
	const leadingChar = str[0];
	const trailingChar = str[str.length - 1];
	const describeChar = (ch) => {
		if (ch === " ") return "space";
		if (ch === "\n") return "newline";
		if (ch === "\t") return "tab";
		return `U+${ch.codePointAt(0).toString(16).toUpperCase()}`;
	};
	const details = [];
	if (/^\s/.test(str)) {
		details.push(`leading=${describeChar(leadingChar)}`);
	}
	if (/\s$/.test(str)) {
		details.push(`trailing=${describeChar(trailingChar)}`);
	}
	return `${parts.join("+")} (${details.join(", ")})`;
}

function logChange(locale, type, key, newKey, value, newValue) {
	const keyInfo = hasOuterWhitespace(key)
		? ` key ws=${describeOuterWhitespace(key)}`
		: "";
	const valueInfo = typeof value === "string" && hasOuterWhitespace(value)
		? ` value ws=${describeOuterWhitespace(value)}`
		: "";
	const compactOldKey = JSON.stringify(key);
	const compactNewKey = JSON.stringify(newKey);
	const compactOldValue = typeof value === "string" ? JSON.stringify(value) : typeof value;
	const compactNewValue = typeof newValue === "string" ? JSON.stringify(newValue) : typeof newValue;

	// Types: key-only, value-only, key-and-value
	console.log(
		`[${locale}] ${type}: key ${compactOldKey} -> ${compactNewKey}; value ${compactOldValue} -> ${compactNewValue}${keyInfo}${valueInfo}`
	);
}

function main() {
	if (!fs.existsSync(localesRoot)) {
		console.error(`Locales root not found: ${localesRoot}`);
		process.exit(1);
	}

	const localeDirs = fs.readdirSync(localesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	let totalKeyChanges = 0;
	let totalValueChanges = 0;
	let totalCollisions = 0;

	for (const locale of localeDirs) {
		const filePath = path.join(localesRoot, locale, "translation.json");
		if (!fs.existsSync(filePath)) {
			continue;
		}

		const originalText = fs.readFileSync(filePath, "utf8");
		let data;
		try {
			data = JSON.parse(originalText);
		} catch (error) {
			console.error(`[${locale}] Failed to parse JSON for ${filePath}:`, error);
			continue;
		}

		const newData = {};
		let localeKeyChanges = 0;
		let localeValueChanges = 0;
		let localeCollisions = 0;

		for (const [key, value] of Object.entries(data)) {
			const trimmedKey = typeof key === "string" ? key.trim() : key;
			const trimmedValue = typeof value === "string" ? value.trim() : value;

			const keyChanged = trimmedKey !== key;
			const valueChanged = trimmedValue !== value;

			if (keyChanged || valueChanged) {
				let type;
				if (keyChanged && valueChanged) {
					type = "key-and-value";
				} else if (keyChanged) {
					type = "key-only";
				} else {
					type = "value-only";
				}
				logChange(locale, type, key, trimmedKey, value, trimmedValue);

				if (keyChanged) localeKeyChanges++;
				if (valueChanged) localeValueChanges++;
			}

			if (Object.prototype.hasOwnProperty.call(newData, trimmedKey)) {
				localeCollisions++;
				console.warn(
					`[${locale}] collision after trimming: existing key and ${JSON.stringify(key)} both map to ${JSON.stringify(trimmedKey)}; keeping existing value.`
				);
				continue;
			}

			newData[trimmedKey] = trimmedValue;
		}

		if (localeKeyChanges || localeValueChanges) {
			const newText = JSON.stringify(newData, null, 2) + "\n";
			fs.writeFileSync(filePath, newText, "utf8");
			console.log(
				`[${locale}] wrote updated translations (keys changed=${localeKeyChanges}, values changed=${localeValueChanges}, collisions=${localeCollisions}).`
			);
		} else {
			console.log(`[${locale}] no outer whitespace to trim.`);
		}

		totalKeyChanges += localeKeyChanges;
		totalValueChanges += localeValueChanges;
		totalCollisions += localeCollisions;
	}

	console.log("=== Whitespace trimming summary ===");
	console.log(`Total keys with outer whitespace trimmed: ${totalKeyChanges}`);
	console.log(`Total values with outer whitespace trimmed: ${totalValueChanges}`);
	console.log(`Total key collisions after trimming: ${totalCollisions}`);
}

if (require.main === module) {
	main();
}
