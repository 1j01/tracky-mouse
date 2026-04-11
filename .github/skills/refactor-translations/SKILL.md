---
name: refactor-translations
description: Use this when existing translatable strings have been modified structurally (e.g. "%0" -> "{{PLACEHOLDER}}", "foo\n" -> "foo", or renaming, splitting, or joining keys)
---

1. Run `npx i18next-cli extract`
2. Run `git diff locales/en/translation.json` and review the new translations and the relations to the old strings and keys. If there are new or modified strings that require translation work, proceed but skip these until the end. (We still don't want to reword things unnecessarily, so don't use the "translate-new-strings" skill for this.)
3. Run `git restore locales/*/translation.json` so that the original strings are back in place for programmatic manipulation.
4. Create a transformation function and test it in isolation first (using Node.js `-e` flag).
5. Run a Node.js command to patch all the locale files (using Node.js `-e` flag).
6. Run `npx i18next-cli extract` again to reorder the keys.
7. Run `npx i18next-cli status` to verify.
   - If needed, run `npx i18next-cli status <lang>` to get a more detailed report for a specific language.
8. Suggest edits to this skill, since there are several types of refactoring meant to be covered, which would benefit from examples.

Here is an example of a Node.js script to patch the new strings into the other language files:

```js
const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, 'core', 'locales');

const valueTransform = (str) => {
  return str.replace(/%0/g, '{{PLACEHOLDER}}');
};

const languages = fs.readdirSync(localesDir);
for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    Object.keys(fileContent).forEach(key => {
      fileContent[key] = valueTransform(fileContent[key]);
    });
    fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
}
```

Note: These commands can be run in the root of the project.
