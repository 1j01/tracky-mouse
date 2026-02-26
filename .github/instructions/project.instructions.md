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

After adding or changing localizable strings, run `npx i18next-cli extract`, then look at the git diff and add translations for any new strings. Then run `npx i18next-cli status` to verify translation completeness.

To add a new language, run `mkdir -p core/locales/$NEW_LANG; cp core/locales/en/translation.json core/locales/$NEW_LANG; npm run update-locales`, then look at `core/locales/$NEW_LANG/translation.json` and add translations for all the strings.

## Changelog

Always update the `CHANGELOG.md` when making any user-facing changes. Write for a broad audience and limit technical jargon. Try to make it clear which part of the project is affected. Skip this step for refactors or other developer-facing changes. Update existing entries in the Unreleased section if applicable, for instance "Removed X" + "Added back part of X" = "Removed X except for Y". Updates to the changelog should be made in the same commit as the code changes.

## Committing

When committing, use the following format for the commit message:

```
<Short summary in present tense>

AI prompt: "<verbatim copy of the message requesting the changes>"

AI description: "<reasoning behind the changes>"
```

Run `npm run lint` before committing.
