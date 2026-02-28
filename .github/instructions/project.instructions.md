---
applyTo: '**'
---

## Project Structure

This project is a monorepo with core (web library), desktop-app (electron app), and website packages.

Use `npm run in-desktop-app -- <command>` to run commands in the desktop-app package, `npm run in-core -- <command>` for the core package, and `npm run in-website -- <command>` for the website package.

Dependencies in the core package should be installed with npm, then added in `copy-deps.js` script to copy them to the `core/lib` folder, and to `loadDependencies` in `core/tracky-mouse.js`. Copy the dependencies with `npm run in-core -- npm run copy-deps`. Adding a new script is a breaking change for consumers that do not use `loadDependencies`, such as the desktop app. Also update `desktop-app.html` and the changelog.

For the desktop app, there is a `scripts/list-ipc-events.js` to help with understanding the flow of data between processes. There is also an architecture section in the main README.

For the website, note that `website/core` and `website/images` are symlinks.

When adding a new setting, search for an existing setting that is similar to it to find all places in the codebase that need to be updated.

When adding a new development script in `scripts`, add it to `eslint.config.js` if it's to be CommonJS.

## Localization

Translations for both core and desktop app are stored in `core/locales/$lang/translation.json`.

After adding or changing localizable strings:
- Run `npx i18next-cli extract`
- Look at the git diff and add translations for any new strings.
- Then run `npx i18next-cli status` to verify translation completeness.

To add a new language:
- Run `npm run new-locale -- $NEW_LANG`
- Replace every translation value in `core/locales/$NEW_LANG/translation.json` with a localized string, while preserving the keys.
- You are not done until every string is localized. Do not ask for confirmation before starting translating. If I ask for a new language, I am assigning you the task of translation.

## Changelog

After making any code changes, **read the content of `CHANGELOG.md`** (specifically the Unreleased section), then follow these rules to decide whether or not to update the changelog.

`CHANGELOG.md` is for users of the desktop app and the API, not for developers of Tracky Mouse.

Do not update the changelog for refactors or other developer-facing changes like adding a debug flag or a new script.

Even if it's a user-facing change, do not add an entry to the changelog if it is a change to a feature that will be new in the next release.

Update existing entries in the Unreleased section if applicable, for instance "Removed X" + "Added back Y from X" = "Removed X, except for Y".

If a fix is made, an applicable caveat may be removed, for instance "Added X, but Y is broken" + "Fixed Y" = "Added X". No mention of the fix should remain, since the bug was never released.

Write for a broad audience and limit technical jargon. Try to make it clear which part of the project is affected. 

## Committing

When committing, use the following format for the commit message:

```
<Short summary in present tense>

AI prompt: "<verbatim copy of the message requesting the changes>"

AI description: "<reasoning behind the changes>"
```

Run `npm run lint` before committing. (This includes eslint and spell checking and `i18next-cli status`.)
