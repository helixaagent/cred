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
  '<h1>CRED EXCHANGE</h1>',
  'CRED EXCHANGE v0.1',
  'https://api.helixa.xyz',
  'https://helixa.xyz/agent.html?id=',
  'https://helixa.xyz/agent/${tid}',
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

const tickerStart = html.indexOf('// Ticker: fetch token stats + terminal stats');
const carouselStart = html.indexOf('// Carousel');
const tickerScript = tickerStart >= 0 && carouselStart > tickerStart ? html.slice(tickerStart, carouselStart) : '';
const duplicateIndex = tickerScript.indexOf('duplicateTickerContent()');
for (const id of ['tk-base', 'tk-solana']) {
  const updateIndex = tickerScript.indexOf(`setTicker('${id}'`);
  if (updateIndex < 0) fail(`ticker script does not update ${id}`);
  if (duplicateIndex >= 0 && updateIndex > duplicateIndex) fail(`ticker script updates ${id} after duplicating ticker content`);
}
if (!tickerScript.includes('replace(/\\sid="[^"]+"/g')) fail('ticker duplicate should strip IDs from cloned content');

for (const file of ['vercel.json', 'README.md', 'icon.svg', 'og-image.svg']) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

if (!process.exitCode) console.log('Static checks passed');
