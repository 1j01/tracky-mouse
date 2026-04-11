---
name: add-new-locale
description: Add support for a new language
---

- Run `npm run new-locale -- $NEW_LANG`
- Replace every translation value in `core/locales/$NEW_LANG/translation.json` with a localized string, while preserving the keys.
- Update the changelog.
- Run `npm run lint`
- Commit with "Add [Some Language] locale" with the AI prompt in the description (but no AI explanation part).
- If I ask for a new language, I am assigning you the task of translation. You are not done until every string is localized, lint passes, and you've committed the changes. Do not ask for confirmation before starting translating or before committing.
- Do not substitute your own process. Do not bother inspecting the i18n setup. The above steps are specifically all I want you to do for this task.
- All the English strings to translate will be in the copied file. Do not bother inspecting the `en/translation.json` which will be identical. Do not inspect other languages for reference, even related languages.
- Verify with `npx i18next-cli status $NEW_LANG`

<!-- Can probably simplify some of the above now that this is in a SKILL.md file... at least the "If I ask for" bit. MAYBE some of the begging to follow the process. -->

Note: These commands can be run in the root of the project.
