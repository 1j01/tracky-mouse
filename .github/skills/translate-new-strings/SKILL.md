---
name: translate-new-strings
description: Use this when there are new strings in the UI that need translation
---

1. Run `npx i18next-cli extract`
2. Run `git diff locales/en/translation.json`. This should show all the new keys and strings that need translation. (You do not need to run the `status` subcommand at this point, and it does not help with showing the strings that need translation.)
3. Look in [`i18next.config.ts`](../../../i18next.config.ts) for the list of languages.
4. Run a Node.js command to patch the new strings into the other language files. Here you will do the actual translation work.
5. Run `npx i18next-cli extract` again to reorder the keys.
6. Run `npx i18next-cli status` to verify.
   - If needed, run `npx i18next-cli status <lang>` to get a more detailed report for a specific language.

Here is an example of a Node.js script to patch the new strings into the other language files:

```js
const fs = require('fs');
const path = require('path');
const newTranslations = {
  "newKey1": {
    "en": "New String 1",
    "es": "Nueva Cadena 1",
    "fr": "Nouvelle Chaîne 1",
    // ... other languages
  },
};
const localesDir = path.join(__dirname, 'core', 'locales');
Object.keys(newTranslations).forEach(key => {
  const translations = newTranslations[key];
  Object.keys(translations).forEach(lang => {
    const filePath = path.join(localesDir, lang, 'translation.json');
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fileContent[key] = translations[lang];
    fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  });
});
```

Note: These commands can be run in the root of the project.
