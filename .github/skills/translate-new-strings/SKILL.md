---
name: translate-new-strings
description: Use this when there are new strings in the UI that need translation
---

Your job is to translate new strings in the UI into all supported languages.

Follow these steps in order:

1. Run `node scripts/translate-new-strings.js --what-needs-translation` to get a list of new strings that need translation, languages that need the strings translated into, and the format to write the translations in.
2. Write the translations in `scripts/new-translations.json` in the given format.
3. Run `npx i18next-cli status` to get a percentage of translation completion.
   - If needed, run `npx i18next-cli status <lang>` to get a more detailed report for a specific language.
4. Check the `emoji` locale specifically, as emoji may get corrupted. Fix using the `apply_patch` tool.
5. Commit with "Add new translations" as the commit message title, with the AI prompt in the description
6. Brainstorm variations for each emoji translation, as these require creativity, and present these as numbered and lettered lists, so that suggestions may be easily accepted.
7. If any suggestions are accepted, amend the commit.

Note: These commands can be run in the root of the project.
