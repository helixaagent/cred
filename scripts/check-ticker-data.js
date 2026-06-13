const API = process.env.HELIXA_API || 'https://api.helixa.xyz';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function getJson(label, path) {
  const res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail(`${label}: expected JSON, got ${text.slice(0, 160)}`);
  }
  if (!res.ok) fail(`${label}: HTTP ${res.status} ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  const terminal = await getJson('terminal stats', '/api/terminal/agents?limit=1&sort=cred_score&dir=desc');
  assert(Array.isArray(terminal.agents), 'terminal stats response missing agents array');
  assert(terminal.agents.length === 1, 'terminal stats response should include one agent');
  assert(terminal.stats && typeof terminal.stats === 'object', 'terminal stats response missing stats object');
  assert(terminal.stats.total > 0, 'ticker missing total agents');
  assert(terminal.stats.scored > 0, 'ticker missing scored agents');
  assert(Number.isFinite(Number(terminal.stats.avgScore)), 'ticker missing average CRED score');
  assert(terminal.stats.x402 > 0, 'ticker missing x402 count');
  assert(terminal.stats.base > 0, 'ticker missing Base agent count');
  assert(terminal.stats.solana > 0, 'ticker missing Solana agent count');

  const cred = await getJson('CRED ticker row', '/api/terminal/agents?limit=1&q=Bendr');
  const credAgent = cred.agents && cred.agents[0];
  assert(credAgent, 'CRED ticker row missing Bendr agent');
  assert(credAgent.token_symbol === 'CRED', `expected Bendr token_symbol CRED, got ${credAgent.token_symbol || 'empty'}`);
  assert(credAgent.token_market_cap > 0, 'CRED ticker row missing market cap');
  assert(credAgent.volume_24h > 0, 'CRED ticker row missing 24h volume');
  assert(typeof credAgent.price_change_24h === 'number', 'CRED ticker row missing 24h price change');

  const mover = await getJson('top mover ticker row', '/api/terminal/agents?limit=1&sort=price_change_24h&dir=desc&filter=trending');
  const moverAgent = mover.agents && mover.agents[0];
  assert(moverAgent && moverAgent.name, 'top mover ticker row missing agent name');
  assert(typeof moverAgent.price_change_24h === 'number', 'top mover ticker row missing 24h price change');

  const aldoByName = await getJson('Aldo VU terminal row', '/api/terminal/agents?limit=3&q=Aldo%20VU');
  const aldoNameMatch = (aldoByName.agents || []).find(agent => agent.token_address?.toLowerCase() === '0x511ef9ad5e645e533d15df605b4628e3d0d0ff53');
  assert(aldoNameMatch, 'Aldo VU missing from terminal search by name');
  assert(aldoNameMatch.token_symbol === 'VU', `expected Aldo VU token_symbol VU, got ${aldoNameMatch.token_symbol || 'empty'}`);
  assert(aldoNameMatch.token_market_cap > 0, 'Aldo VU missing market cap');

  const aldoByToken = await getJson('Aldo VU token lookup', '/api/terminal/agent/0x511ef9Ad5E645E533D15DF605B4628e3D0d0Ff53');
  assert(aldoByToken.name === 'Aldo VU', `expected token lookup to return Aldo VU, got ${aldoByToken.name || 'empty'}`);
  assert(aldoByToken.token_symbol === 'VU', `expected token lookup token_symbol VU, got ${aldoByToken.token_symbol || 'empty'}`);

  console.log('Ticker data checks passed');
})().catch(error => fail(error.stack || error.message));
