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
  'CRED.EXCHANGE V0.21 - POWERED BY HELIXA PROTOCOL',
  'Date provided by agentscan.io and helixaprotocol.com. All rights reserved.',
  'https://api.helixa.xyz',
  'class="agent-link"',
  '/api/terminal/agent/',
  'data-chain="all"',
  'data-chain="base"',
  'data-chain="solana"',
  "if (currentChain !== 'all') params.set('chain', currentChain);",
  "document.querySelectorAll('.chain-btn').forEach(btn => {",
  "btn.addEventListener('click', () => setChain(btn.dataset.chain || 'all', btn));",
  'placeholder="Input agent name, address, or ID to run report..........."',
  '<button type="button" id="search-btn">ANALYZE</button>',
  'id="cred-report-modal"',
  'function openCredReportModal',
  'async function runCredReport',
  "if (!options.singleAgent) { currentSearch = query; currentPage = 1; fetchAgents(); }",
  'async function typeReportLine',
  'function showReportCursor',
  'report-cursor',
  'SCANNING AGENT INDEX',
  'CALCULATING CRED SIGNALS',
  'function findBestReportAgent',
  'function filterFallbackAgents',
  'MATCHING INPUT AGAINST NAME / ADDRESS / ID...',
  'id="submit-agent-btn"',
  'SUBMIT AGENT',
  'id="submit-agent-modal"',
  'id="submit-agent-form"',
  'async function submitAgentListing',
  '/api/terminal/submit-agent',
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

let fallbackData;
try {
  fallbackData = JSON.parse(fallback);
} catch (error) {
  fail(`terminal/fallback.json is invalid JSON: ${error.message}`);
}

const fallbackAgents = Array.isArray(fallbackData.agents) ? fallbackData.agents : [];
const fallbackVu = fallbackAgents.find(agent => String(agent.token_address || '').toLowerCase() === '0x511ef9ad5e645e533d15df605b4628e3d0d0ff53');
if (!fallbackVu) fail('terminal/fallback.json missing VU token row');
else {
  if (fallbackVu.name !== 'VU') fail(`fallback VU row has wrong name: ${fallbackVu.name}`);
  if (fallbackVu.agent_id !== 'helixa-1127') fail(`fallback VU row has wrong agent_id: ${fallbackVu.agent_id}`);
  if (fallbackVu.token_symbol !== 'VU') fail(`fallback VU row has wrong token symbol: ${fallbackVu.token_symbol}`);
}
if (fallbackAgents.some(agent => agent.name === 'Aldo VU')) fail('terminal/fallback.json still contains mistaken Aldo VU row');
const fallbackAxobotl = fallbackAgents.find(agent => agent.name === 'Axobotl' && agent.agent_id === 'helixa-1069');
if (!fallbackAxobotl) fail('terminal/fallback.json missing Axobotl helixa-1069 row');
else {
  if (fallbackAxobotl.cred_score !== 85) fail(`fallback Axobotl row has wrong CRED score: ${fallbackAxobotl.cred_score}`);
  if (fallbackAxobotl.cred_tier !== 'PRIME') fail(`fallback Axobotl row has wrong tier: ${fallbackAxobotl.cred_tier}`);
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
  '<button type="button" id="search-btn">SCAN</button>',
  'placeholder="Search by name, address, or agent ID..."',
  'placeholder="Input agent name to run report..........."',
  'CRED.EXCHANGE v0.1',
  'Powered by <a href="https://cred.exchange">CRED Protocol</a>',
  'Data from agentscan.info and Helixa infrastructure',
]) {
  if (html.includes(forbidden)) fail(`index.html still contains ${forbidden}`);
}

for (const file of ['vercel.json', 'README.md', 'icon.svg', 'og-image.svg']) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

if (!process.exitCode) console.log('Static checks passed');
