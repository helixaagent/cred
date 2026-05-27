const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const fallbackPath = path.join(root, 'terminal', 'fallback.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

const html = fs.readFileSync(indexPath, 'utf8');
const fallback = fs.readFileSync(fallbackPath, 'utf8');

for (const expected of [
  '<title>CRED Exchange',
  '<h1>CRED.EXCHANGE</h1>',
  'CRED.EXCHANGE v0.1',
  'https://api.helixa.xyz',
  'https://helixa.xyz/agent.html?id=',
  'data-chain="all"',
  'data-chain="base"',
  'data-chain="solana"',
  "if (currentChain !== 'all') params.set('chain', currentChain);",
  "document.querySelectorAll('.chain-btn').forEach(btn => {",
  "btn.addEventListener('click', () => setChain(btn.dataset.chain || 'all', btn));",
]) {
  if (!html.includes(expected)) fail(`index.html missing ${expected}`);
}

for (const forbidden of [
  'Agent Terminal by Helixa',
  'Powered by <a href="https://helixa.xyz">Helixa</a>',
  'href="/agent.html',
  'href="/agent/${tid}',
]) {
  if (html.includes(forbidden)) fail(`index.html still contains ${forbidden}`);
}

try {
  JSON.parse(fallback);
} catch (error) {
  fail(`terminal/fallback.json is invalid JSON: ${error.message}`);
}

for (const forbidden of [
  'onclick="setChain',
  'console.log(\'setChain:',
  'console.log(\'fetchAgents chain:',
  'carousel-wrap',
  'carousel-track',
  'renderCarousel',
  '>REGISTERED<',
  'formatDate(',
  'colspan="10"',
]) {
  if (html.includes(forbidden)) fail(`index.html still contains ${forbidden}`);
}

for (const file of ['vercel.json', 'README.md', 'icon.svg', 'og-image.svg']) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

if (!process.exitCode) console.log('Static checks passed');
