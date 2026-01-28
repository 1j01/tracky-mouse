const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cliMdPath = path.join(__dirname, '..', 'CLI.md');
const cliHelpOutput = execSync('npx tracky-mouse --help').toString().trim();
const oldMarkdown = fs.readFileSync(cliMdPath, 'utf8');
const newMarkdown = oldMarkdown.replace(/```HELP_OUTPUT.+?```/s, '```HELP_OUTPUT\n' + cliHelpOutput + '\n```');
fs.writeFileSync(cliMdPath, newMarkdown);
