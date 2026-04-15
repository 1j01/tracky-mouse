---
name: translate-new-strings
description: Use this when there are new strings in the UI that need translation
---

Follow these steps in order:

1. Run `npx i18next-cli extract` (If you run the `status` subcommand at this point, the developer's head will explode with frustration, and you will gain no information.)
2. Run `git diff core/locales/en/translation.json`. This will show all the new keys and strings up for translation. (If you run the `status` subcommand at this point, the developer's head will explode with frustration, and you will gain no information.)
3. Look in [`i18next.config.ts`](../../../i18next.config.ts) for the list of languages.
4. Run a Node.js command (using a heredoc) to patch the new strings into the other language files. Here you will do the actual translation work. See below for an example.
5. Run `npx i18next-cli extract` again to reorder the keys.
6. Run `npx i18next-cli status` to get a percentage of translation completion.
   - If needed, run `npx i18next-cli status <lang>` to get a more detailed report for a specific language.
7. Check the `emoji` locale specifically, as emoji may get corrupted. Fix using the `apply_patch` tool.
8. Commit with "Add new translations" with the AI prompt in the description (but no AI explanation part).
9. Brainstorm variations for each emoji translation, as these require creativity, and present these as numbered and lettered lists, so that suggestions may be easily accepted.
10. If any suggestions are accepted, amend the commit.

Here is an example of a Node.js script to patch the new strings into the other language files:

```js
const fs = require('fs');
const path = require('path');
// Here you must do the actual translation work.
// If you were to simply copy the English strings, the developer's head would explode
// with frustration, and hundreds of users suffering from ALS, spinal cord injuries,
// or other disabilities would be unable to use their computer.
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
