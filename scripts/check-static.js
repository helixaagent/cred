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
  '<button type="button" class="filter-btn" data-tier="bankr">BANKR</button>',
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
  "if (currentFilter === 'bankr') return agent.platform === 'bankr' || String(agent.metadata || '').includes('\\\"source\\\":\\\"bankr-app\\\"');",
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

if (fallbackData.total < 195000) fail(`terminal/fallback.json total shrank below restored baseline: ${fallbackData.total}`);
if ((fallbackData.stats?.total || 0) < 195000) fail(`terminal/fallback.json stats.total shrank below restored baseline: ${fallbackData.stats?.total}`);
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
  if (String(fallbackAxobotl.token_address || '').toLowerCase() !== '0x810affc8aadad2824c65e0a2c5ef96ef1de42ba3') fail(`fallback Axobotl row has wrong token address: ${fallbackAxobotl.token_address || 'empty'}`);
  if (fallbackAxobotl.token_symbol !== 'AXOBOTL') fail(`fallback Axobotl row has wrong token symbol: ${fallbackAxobotl.token_symbol || 'empty'}`);
}
const fallbackDrb = fallbackAgents.find(agent => String(agent.token_address || '').toLowerCase() === '0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2');
if (!fallbackDrb) fail('terminal/fallback.json missing DRB Bankr row');
else {
  if (fallbackDrb.name !== 'DebtReliefBot') fail(`fallback DRB row has wrong name: ${fallbackDrb.name}`);
  if (fallbackDrb.platform !== 'bankr') fail(`fallback DRB row has wrong platform: ${fallbackDrb.platform || 'empty'}`);
  if (fallbackDrb.token_symbol !== 'DRB') fail(`fallback DRB row has wrong token symbol: ${fallbackDrb.token_symbol || 'empty'}`);
}
const fallbackSibyl = fallbackAgents.find(agent => agent.name === 'SIBYL' && agent.agent_id === 'helixa-1037');
if (!fallbackSibyl) fail('terminal/fallback.json missing SIBYL helixa-1037 row');
else {
  if (fallbackSibyl.cred_score !== 65) fail(`fallback SIBYL row has wrong CRED score: ${fallbackSibyl.cred_score}`);
  if (fallbackSibyl.cred_tier !== 'QUALIFIED') fail(`fallback SIBYL row has wrong tier: ${fallbackSibyl.cred_tier}`);
  if (String(fallbackSibyl.token_address || '').toLowerCase() !== '0x797f214a2cd64a4963a91fa21c8c55ec3eba4714') fail(`fallback SIBYL row has wrong token address: ${fallbackSibyl.token_address || 'empty'}`);
  if (fallbackSibyl.token_symbol !== 'SIBYL') fail(`fallback SIBYL row has wrong token symbol: ${fallbackSibyl.token_symbol || 'empty'}`);
}
const fallbackMfergpt = fallbackAgents.find(agent => agent.name === 'mferGPT' && (agent.agent_id === 'helixa-73' || agent.token_id === 'helixa-73'));
if (!fallbackMfergpt) fail('terminal/fallback.json missing mferGPT helixa-73 row');
else {
  if (String(fallbackMfergpt.token_address || '').toLowerCase() !== '0x4160efdd66521483c22cb98b57b87d1fdafeab07') fail(`fallback mferGPT row has wrong token address: ${fallbackMfergpt.token_address || 'empty'}`);
  if (fallbackMfergpt.token_symbol !== 'MFERGPT') fail(`fallback mferGPT row has wrong token symbol: ${fallbackMfergpt.token_symbol || 'empty'}`);
}
if (fallbackAgents.some(agent => agent.name === 'mferGPT' && String(agent.token_address || '').toLowerCase() === '0x5c76bf1cf910aea617d732b5f39439240325eec8')) {
  fail('terminal/fallback.json still contains fake mferGPT token row');
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
