const API = process.env.HELIXA_API || 'https://api.helixa.xyz';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function getJson(label, pathOrUrl) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
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

  const bankrProfiles = await getJson('Bankr app profiles', 'https://api.bankr.bot/agent-profiles?sort=marketCap&limit=100');
  const bankrTokenProfiles = (bankrProfiles.profiles || []).filter(profile => profile.tokenAddress);
  assert(bankrProfiles.total >= 50, `Bankr app profile count unexpectedly low: ${bankrProfiles.total || 0}`);
  assert(bankrTokenProfiles.length >= 50, `Bankr app tokenized profile count unexpectedly low: ${bankrTokenProfiles.length}`);
  const bankrProfileBySlug = new Map(bankrTokenProfiles.map(profile => [profile.slug, profile]));
  for (const slug of ['gitlawb', 'aeon', 'nookplot', 'perkos', 'teligent', 'agent-remilia', 'helixa', 'axobotl']) {
    const profile = bankrProfileBySlug.get(slug);
    assert(profile, `Bankr app profile list missing expected slug ${slug}`);
    const terminalProfile = await getJson(
      `Bankr app profile ${profile.projectName || profile.slug || profile.tokenSymbol}`,
      `/api/terminal/agent/${profile.tokenAddress}`
    );
    assert(
      terminalProfile.token_address?.toLowerCase() === profile.tokenAddress.toLowerCase(),
      `Bankr app profile ${profile.projectName || profile.slug || profile.tokenSymbol}: token lookup returned ${terminalProfile.token_address || 'empty'}`
    );
  }

  const bankrFilter = await getJson('Bankr filter rows', '/api/terminal/agents?limit=100&filter=bankr&sort=token_market_cap&dir=desc');
  assert(bankrFilter.total >= 59, `Bankr filter returned too few rows: ${bankrFilter.total}`);
  const bankrFilterAddresses = new Set((bankrFilter.agents || []).map(agent => String(agent.token_address || '').toLowerCase()));
  for (const [label, address] of [
    ['gitlawb', '0x5f980dcfc4c0fa3911554cf5ab288ed0eb13dba3'],
    ['CRED canonical Helixa row', '0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3'],
    ['Axobotl canonical Helixa row', '0x810affc8aadad2824c65e0a2c5ef96ef1de42ba3'],
    ['DRB Bankr row', '0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2'],
  ]) {
    assert(bankrFilterAddresses.has(address), `Bankr filter missing ${label}`);
  }

  const drb = await getJson('DRB Bankr row', '/api/terminal/agent/0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2');
  assert(drb.name === 'DebtReliefBot', `expected DRB row name DebtReliefBot, got ${drb.name || 'empty'}`);
  assert(drb.platform === 'bankr', `expected DRB platform bankr, got ${drb.platform || 'empty'}`);
  assert(drb.token_symbol === 'DRB', `expected DRB token symbol, got ${drb.token_symbol || 'empty'}`);

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

  for (const [label, dir, ordered] of [
    ['24H descending sort', 'desc', (prev, next) => prev >= next],
    ['24H ascending sort', 'asc', (prev, next) => prev <= next],
  ]) {
    const sorted = await getJson(label, `/api/terminal/agents?limit=12&sort=price_change_24h&dir=${dir}`);
    const changes = (sorted.agents || [])
      .map(agent => agent.price_change_24h)
      .filter(value => typeof value === 'number');
    assert(changes.length >= 8, `${label}: expected at least 8 rows with 24H data, got ${changes.length}`);
    for (let i = 1; i < changes.length; i++) {
      assert(ordered(changes[i - 1], changes[i]), `${label}: row ${i + 1} is out of order (${changes[i - 1]} then ${changes[i]})`);
    }
  }

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

  const mfergptByName = await getJson('mferGPT terminal row', '/api/terminal/agents?limit=10&q=mfergpt');
  const mfergptNameMatch = (mfergptByName.agents || []).find(agent => agent.name === 'mferGPT' && agent.agent_id === 'helixa-73');
  assert(mfergptNameMatch, 'mferGPT missing from terminal search by name');
  assert(mfergptNameMatch.token_address?.toLowerCase() === '0x4160efdd66521483c22cb98b57b87d1fdafeab07', `expected mferGPT token address 0x4160..., got ${mfergptNameMatch.token_address || 'empty'}`);
  assert(mfergptNameMatch.token_symbol === 'MFERGPT', `expected mferGPT token_symbol MFERGPT, got ${mfergptNameMatch.token_symbol || 'empty'}`);
  assert(!((mfergptByName.agents || []).some(agent => agent.name === 'mferGPT' && agent.token_address?.toLowerCase() === '0x5c76bf1cf910aea617d732b5f39439240325eec8')), 'mferGPT search still returns fake token address 0x5c76...');

  const mfergptByExactName = await getJson('mferGPT exact lookup', '/api/terminal/agent/mfergpt');
  assert(mfergptByExactName.name === 'mferGPT', `expected exact lookup to return mferGPT, got ${mfergptByExactName.name || 'empty'}`);
  assert(mfergptByExactName.agent_id === 'helixa-73', `expected exact lookup agent_id helixa-73, got ${mfergptByExactName.agent_id || 'empty'}`);
  assert(mfergptByExactName.token_address?.toLowerCase() === '0x4160efdd66521483c22cb98b57b87d1fdafeab07', `expected exact lookup mferGPT token address 0x4160..., got ${mfergptByExactName.token_address || 'empty'}`);
  assert(mfergptByExactName.token_symbol === 'MFERGPT', `expected exact lookup mferGPT token_symbol MFERGPT, got ${mfergptByExactName.token_symbol || 'empty'}`);

  const mfergptByToken = await getJson('mferGPT token lookup', '/api/terminal/agent/0x4160efDd66521483c22Cb98b57b87d1fDAfeaB07');
  assert(mfergptByToken.name === 'mferGPT', `expected token lookup to return mferGPT, got ${mfergptByToken.name || 'empty'}`);
  assert(mfergptByToken.token_symbol === 'MFERGPT', `expected token lookup token_symbol MFERGPT, got ${mfergptByToken.token_symbol || 'empty'}`);

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
