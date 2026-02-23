const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let currentLocale = 'en';
let translations = {};

function tryLoad(locale) {
	// const corePath = require.resolve('tracky-mouse');
	const corePath = path.resolve(__dirname, '../../node_modules/tracky-mouse');
	const localesPath = path.resolve(corePath, 'locales', locale, 'translation.json');
	try {
		const data = fs.readFileSync(localesPath, 'utf8');
		translations = JSON.parse(data);
		currentLocale = locale;
		return true;
	} catch (error) {
		if (error.code !== 'ENOENT') {
			console.error(`Error loading locale ${locale} from ${localesPath}:`, error);
		} else {
			console.warn(`Tried locale ${locale} but no translation file found at ${localesPath}.`);
		}
		return false;
	}
}

/** @NOTE this must be called after the 'ready' event */
function setLocale(locale) {
	if (!locale) locale = app.getLocale() || 'en';
	// Try full locale (e.g., en-US), then base (en), then fallback to en
	if (tryLoad(locale)) return;
	const base = locale.split('-')[0];
	if (base !== locale && tryLoad(base)) return;
	tryLoad('en');
}

/**
 * Translate a string
 * @param {string} s
 * @returns {string}
 */
function t(s) {
	return translations && Object.prototype.hasOwnProperty.call(translations, s) ? translations[s] : s;
}

module.exports = { setLocale, t, getLocale: () => currentLocale };
