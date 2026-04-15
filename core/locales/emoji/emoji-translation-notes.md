# Emoji translation notes

## Motivation

fun

## *Justification*

Translating your app to emoji can
1. highlight UI that is overly technical, dense, or unclear
   - For example, the description for the "Tilt influence" slider is very long and includes technical jargon like "point tracking" (at least better than "optical flow", right? idk...) as well as side notes
     - You have to stop and think about how to convey concepts, and the difficulty in conveying a concept may reflect the difficulty users have in understanding it
     - In emoji, the side notes feel overwhelming as they're hard to distinguish from the main point, which may very well be a real user's experience with real languages
2. highlight problems with lack of context for translators (AI or human), as you're able to take on the role of translator even if you don't know another language
   - For example, I translated "Check for updates" as if it was a menu item to manually check for updates, even though it was a checkbox label for auto update checking
   - Semantic keys would help to give context for translation and also allow for identical text in one language to be translated differently in different contexts

## Emoji as a language

We're not doing [this attempt at an emoji language](https://www.theemojilanguage.com/) that uses two emoji for every word even if it makes it unclear.

IMO sitting down and thinking about how to convey each concept in context is the only true path.

## Resources

https://emojidb.org/ is the #1 stop shop for emoji search. They make it easy to contribute, so there's a big database. Though I wish they'd filter out profanity on unrelated search results.

## Current glossary

TODO: copy from brainstorming section and remove unused options

## Glossary brainstorming

### Motion

- movement: ↔️↕️
- stop temporarily: ⚓, 🛑↔️↕️, ⏸️↔️↕️
- rotation: 💫, 🌪️, 🌀, ↩️, ↪️, ⤴️, ⤵️, 🔃, 🔄, 🔁, 🧭, ⟳
  - yaw: 🙂‍↔️
  - pitch: 🙂‍↕️
  - roll: 🙃
- center, middle: 🎯, 👉|👈, 👉👈, 🪹??, 🏠??, ⚓?, 🪆???
- border, limit: 🧱, 📐, 🗜️, 🔳, 🔲, ... + screen
- range, extent, limit: 🫸📏🫷
- free-moving, unconstrained: 🪁, 🪶, 🪽, 🧈
- smooth, adj.: 🧈
- smooth, v.: 🧴, 🧈
- at rest: 🛏️, 🪑, 💤, 🚷
- slow: 🐌
- fast: 🐆, 🏎️💨
- speed: 🏃, 👟

### Ontological

- is, are, equals, means: 🟰
- gives, causes, results in, leads to, becomes, is mapped to: 🎁, 🤲, 🫴, 👉, ➡️, 🟰, :
- trigger: 🧨, 🚩
- case, if-then-else condition:
  - A❓B
  - A❓➡️B
  - A❓B; 🚫A❓C
  - A❓➡️ B; 🚫A❓➡️ C
  - A❓➡️ B; 🚫❓➡️ C
- not: 🚫, ❌, 🙅
- don't: 🚫, ❌, 🙅
- before: ⏪, ⏮️
- after: ⏩, ⏭️

### Anatomy

- eyes: 👀, 
- closed eyes: 🫣, 🙈, 🫣👀, 🙈👀
- neck: 🦒, 🦕

### Objects

- external switch (jelly button etc.): 🖲️ (actually a trackball)

### Settings

- setting: ⚙️, 🎚️
- modify a setting: ⚙️🔧, 🫳⚙️, 🎚️↕️, 🎚️🤏
- default: 🏁, 🤷
- new setting value: 🆕⚙️🔢
- old setting value: ⚙️🔢
- language: some combination of 🌐, 🌍, 🌎, 🌏, 🗣️, 💬, 📝, ✍️, ✏️, 📜, 🔠, 🔡, 🔤, 📖, 友
- general settings: 💼, 🗄️, 🧰, ✳️, ❇️, 🫟, *️⃣
- calibration: 🎯, 🎯🤏
- experimental: 🧪, ⚗️
- brightness: 🔅, 🔆
- switch, swap mouse buttons: 🔀🖱️
- pointer speed: 🖱️🏃, 🖱️🐌🐆, 🖱️💨


### Misc.

- Tracky Mouse: ⦟𝄈ᵓ]⊐, Tracky Mouse, TrackyMouse, ™️, ♿🧑🖱️™️, actual logo?
- computer, PC, operating system, OS: 🖥️, 💻
- CLI input: 📥
- CLI output: 📤
- Esperanto: 🟩, <svg viewBox="0 0 600 400" height="20">
<path fill="#FFF" d="m0,0h202v202H0"/>
<path fill="#090" d="m0,200H200V0H600V400H0m58-243 41-126 41,126-107-78h133"/>
</svg>
- Git: 🐙, 🐙👨🏻‍💻, 👨🏻‍💻🐙, 🐙🛠️
  - pull: 🧲
  - GitHub: 🐙😺
- recommendation: 👍 (+ equals, colon?), 💡
  - not recommended: 👎
  - setting not recommended: 👎⚙️, ⚙️🟰👎
- cursor, pointer, arrow: 🖱️, 👆, 🮰
- click: 🖱️💥, 👆💥
- grab: ✋➡️✊, 🫳🤜, ✋✊, 🖐️✊, ✊, ✋✊✋
- easy: 🏖️, 😎, 😊, 👍
- help: 🛟, ℹ️, 🙋, 💁
- network: 📶, 🛜, 🌐
- control in general, computer control: 🖥️🕹️
- grant camera access: 🔓📷, 🔓🔑📷, 🔐📷, ✅📷, 📷✅
- CLI: 🆑, 👨‍💻, 📟, >_
- per: ➗, /
- external: ↗️
- external link: ↗️🌐
- camera in use: 📷🟰📸, 📸
- not found: 🔎🥺, 🔎🤷
- sound effect: 🔊✨, 🔉✨, 👂✨
  - lack thereof: 🔇, 🚫👂✨, 🚫🔊✨
- ignored: 🙈, 🤷, 🙈🤷
- update: 🆙
  - new version: 🆕📦
  - old version: 👴📦

### Unused

- camera id: 🫆, 🆔
- diagnostics: 🩺
- workaround, partial solution: 🩹
- comes back: 🪃 (related to calibration where it 🪃 from the 📐)
- jitter: 🎲↔️↕️, 📷🫨
- panorama-like multi-image capture: 🪩+camera (planned for training a ML model for tongue pose recognition, not necessarily user facing)

## Todo

- 🫣vs🙈, clarify closed eyes vs ignored
- unify restart app as 🔁🚀
- git as 🐙🛠️?
- unify head tilt stuff to include a head?
- clearer "rotation" than 💫
- clearer "grab gesture" than ✋➡️✊
