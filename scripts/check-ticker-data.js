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
  assert(terminal.stats.total >= 180000, `terminal corpus shrank below restored baseline: expected >= 180000 agents, got ${terminal.stats.total}`);
  assert(terminal.stats.scored > 0, 'ticker missing scored agents');
  assert(Number.isFinite(Number(terminal.stats.avgScore)), 'ticker missing average CRED score');
  assert(terminal.stats.x402 > 0, 'ticker missing x402 count');
  assert(terminal.stats.base > 0, 'ticker missing Base agent count');
  assert(terminal.stats.solana > 0, 'ticker missing Solana agent count');

  for (const [label, path, minimum] of [
    ['ETH ERC-8004 corpus', '/api/terminal/agents?limit=1&chain=eth', 49000],
    ['BSC ERC-8004 corpus', '/api/terminal/agents?limit=1&chain=bsc', 33000],
  ]) {
    const chain = await getJson(label, path);
    assert(chain.total >= minimum, `${label} shrank below restored baseline: expected >= ${minimum}, got ${chain.total}`);
  }

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

  const vuByName = await getJson('VU terminal row', '/api/terminal/agents?limit=10&q=VU');
  const vuNameMatch = (vuByName.agents || []).find(agent => agent.name === 'VU' && agent.agent_id === 'helixa-1127');
  assert(vuNameMatch, 'VU missing from terminal search by name');
  assert(vuNameMatch.token_address?.toLowerCase() === '0x511ef9ad5e645e533d15df605b4628e3d0d0ff53', `expected VU token address 0x511e..., got ${vuNameMatch.token_address || 'empty'}`);
  assert(vuNameMatch.token_symbol === 'VU', `expected VU token_symbol VU, got ${vuNameMatch.token_symbol || 'empty'}`);
  assert(vuNameMatch.token_market_cap > 0, 'VU missing market cap');

  const vuByToken = await getJson('VU token lookup', '/api/terminal/agent/0x511ef9Ad5E645E533D15DF605B4628e3D0d0Ff53');
  assert(vuByToken.name === 'VU', `expected token lookup to return VU, got ${vuByToken.name || 'empty'}`);
  assert(vuByToken.agent_id === 'helixa-1127', `expected token lookup agent_id helixa-1127, got ${vuByToken.agent_id || 'empty'}`);
  assert(vuByToken.token_symbol === 'VU', `expected token lookup token_symbol VU, got ${vuByToken.token_symbol || 'empty'}`);

  const axobotlByName = await getJson('Axobotl terminal row', '/api/terminal/agents?limit=10&q=Axobotl');
  const axobotlNameMatch = (axobotlByName.agents || []).find(agent => agent.name === 'Axobotl' && agent.agent_id === 'helixa-1069');
  assert(axobotlNameMatch, 'Axobotl missing from terminal search by name');
  assert(axobotlNameMatch.cred_score === 85, `expected Axobotl CRED score 85, got ${axobotlNameMatch.cred_score}`);
  assert(axobotlNameMatch.cred_tier === 'PRIME', `expected Axobotl tier PRIME, got ${axobotlNameMatch.cred_tier || 'empty'}`);
  assert(axobotlNameMatch.token_address?.toLowerCase() === '0x810affc8aadad2824c65e0a2c5ef96ef1de42ba3', `expected Axobotl token address 0x810a..., got ${axobotlNameMatch.token_address || 'empty'}`);
  assert(axobotlNameMatch.token_symbol === 'AXOBOTL', `expected Axobotl token_symbol AXOBOTL, got ${axobotlNameMatch.token_symbol || 'empty'}`);
  assert(axobotlNameMatch.token_market_cap > 0, 'Axobotl missing market cap');

  const axobotlByExactName = await getJson('Axobotl exact lookup', '/api/terminal/agent/Axobotl');
  assert(axobotlByExactName.name === 'Axobotl', `expected exact lookup to return Axobotl, got ${axobotlByExactName.name || 'empty'}`);
  assert(axobotlByExactName.agent_id === 'helixa-1069', `expected exact lookup agent_id helixa-1069, got ${axobotlByExactName.agent_id || 'empty'}`);
  assert(axobotlByExactName.cred_score === 85, `expected exact lookup Axobotl CRED score 85, got ${axobotlByExactName.cred_score}`);
  assert(axobotlByExactName.token_symbol === 'AXOBOTL', `expected exact lookup Axobotl token_symbol AXOBOTL, got ${axobotlByExactName.token_symbol || 'empty'}`);

  const axobotlByToken = await getJson('Axobotl token lookup', '/api/terminal/agent/0x810aFFc8AAdAD2824C65E0A2C5Ef96eF1De42ba3');
  assert(axobotlByToken.name === 'Axobotl', `expected token lookup to return Axobotl, got ${axobotlByToken.name || 'empty'}`);
  assert(axobotlByToken.agent_id === 'helixa-1069', `expected token lookup agent_id helixa-1069, got ${axobotlByToken.agent_id || 'empty'}`);
  assert(axobotlByToken.token_symbol === 'AXOBOTL', `expected token lookup token_symbol AXOBOTL, got ${axobotlByToken.token_symbol || 'empty'}`);

  const sibylByName = await getJson('SIBYL terminal row', '/api/terminal/agents?limit=10&q=Sibyl');
  const sibylNameMatch = (sibylByName.agents || []).find(agent => agent.name === 'SIBYL' && agent.agent_id === 'helixa-1037');
  assert(sibylNameMatch, 'SIBYL missing from terminal search by name');
  assert(sibylNameMatch.cred_score === 65, `expected SIBYL CRED score 65, got ${sibylNameMatch.cred_score}`);
  assert(sibylNameMatch.cred_tier === 'QUALIFIED', `expected SIBYL tier QUALIFIED, got ${sibylNameMatch.cred_tier || 'empty'}`);
  assert(sibylNameMatch.token_address?.toLowerCase() === '0x797f214a2cd64a4963a91fa21c8c55ec3eba4714', `expected SIBYL token address 0x797f..., got ${sibylNameMatch.token_address || 'empty'}`);
  assert(sibylNameMatch.token_symbol === 'SIBYL', `expected SIBYL token_symbol SIBYL, got ${sibylNameMatch.token_symbol || 'empty'}`);
  assert(sibylNameMatch.token_market_cap > 0, 'SIBYL missing market cap');

  const sibylByToken = await getJson('SIBYL token lookup', '/api/terminal/agent/0x797f214a2CD64a4963A91Fa21c8C55Ec3EBa4714');
  assert(sibylByToken.name === 'SIBYL', `expected token lookup to return SIBYL, got ${sibylByToken.name || 'empty'}`);
  assert(sibylByToken.agent_id === 'helixa-1037', `expected token lookup agent_id helixa-1037, got ${sibylByToken.agent_id || 'empty'}`);
  assert(sibylByToken.token_symbol === 'SIBYL', `expected token lookup token_symbol SIBYL, got ${sibylByToken.token_symbol || 'empty'}`);

  for (const [label, path, expected] of [
    ['Helixa token 0 restored lookup', '/api/terminal/agent/helixa-0', { name: 'E2ETest', agent_id: 'helixa-0' }],
    ['Helixa historical restored lookup', '/api/terminal/agent/helixa-1764', { name: 'JKILLR', agent_id: 'helixa-1764' }],
    ['Helixa shared-wallet restored lookup', '/api/terminal/agent/helixa-2079', { name: 'd1mka17Agent', agent_id: 'helixa-2079' }],
  ]) {
    const restored = await getJson(label, path);
    assert(restored.name === expected.name, `${label}: expected ${expected.name}, got ${restored.name || 'empty'}`);
    assert(restored.agent_id === expected.agent_id, `${label}: expected ${expected.agent_id}, got ${restored.agent_id || 'empty'}`);
    assert(restored.platform === 'helixa', `${label}: expected platform helixa, got ${restored.platform || 'empty'}`);
  }

  console.log('Ticker data checks passed');
})().catch(error => fail(error.stack || error.message));
