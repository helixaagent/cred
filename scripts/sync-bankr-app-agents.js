const fs = require('fs');
const path = require('path');
const Database = require('/home/ubuntu/.openclaw/workspace/agentdna/api/node_modules/better-sqlite3');

const TERMINAL_DB = process.env.TERMINAL_DB || '/home/ubuntu/.openclaw/workspace/terminal/data/terminal.db';
const BACKUP_DIR = path.join(path.dirname(TERMINAL_DB), 'backups');
const BANKR_PROFILES_URL = 'https://api.bankr.bot/agent-profiles?sort=marketCap&limit=100';
const DEX_BATCH_SIZE = 30;
const STRONG_PROVENANCE = new Set(['helixa', 'erc8004-direct', 'erc8004', '8004scan', 'openclaw', 'clawnch', 'virtuals', 'dxrg']);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function round(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function tierOf(score) {
  return score >= 91 ? 'PREFERRED' : score >= 76 ? 'PRIME' : score >= 51 ? 'QUALIFIED' : score >= 26 ? 'MARGINAL' : 'JUNK';
}

function seconds(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : Math.floor(Date.now() / 1000);
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function betterDexPair(current, candidate) {
  if (!candidate?.baseToken?.address) return current;
  if (!current) return candidate;
  const candidateBase = candidate.chainId === 'base';
  const currentBase = current.chainId === 'base';
  if (candidateBase && !currentBase) return candidate;
  if (!candidateBase && currentBase) return current;
  return (candidate.liquidity?.usd || 0) > (current.liquidity?.usd || 0) ? candidate : current;
}

function marketFromPair(pair, profile) {
  return {
    token_symbol: pair?.baseToken?.symbol || profile.tokenSymbol || null,
    token_name: pair?.baseToken?.name || profile.tokenName || profile.projectName || null,
    token_market_cap: round(pair?.marketCap ?? pair?.fdv ?? profile.marketCapUsd),
    price_change_24h: round(pair?.priceChange?.h24),
    volume_24h: round(pair?.volume?.h24),
    liquidity_usd: round(pair?.liquidity?.usd),
    txns_24h_buys: Number.isFinite(Number(pair?.txns?.h24?.buys)) ? Number(pair.txns.h24.buys) : null,
    txns_24h_sells: Number.isFinite(Number(pair?.txns?.h24?.sells)) ? Number(pair.txns.h24.sells) : null,
  };
}

async function getJson(label, url) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'OpenClaw CRED Exchange sync' } });
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

async function fetchBankrProfiles() {
  const data = await getJson('Bankr app profiles', BANKR_PROFILES_URL);
  const profiles = (data.profiles || []).filter(profile => profile.tokenAddress);
  if (data.total < 50 || profiles.length < 50) fail(`Bankr app profile count unexpectedly low: total=${data.total}, tokenized=${profiles.length}`);
  const deduped = new Map();
  for (const profile of profiles) deduped.set(normalizeAddress(profile.tokenAddress), profile);
  return [...deduped.values()].sort((a, b) => Number(b.marketCapUsd || 0) - Number(a.marketCapUsd || 0));
}

async function fetchMarkets(profiles) {
  const markets = new Map();
  const addresses = profiles.map(profile => profile.tokenAddress).filter(Boolean);
  for (let i = 0; i < addresses.length; i += DEX_BATCH_SIZE) {
    const batch = addresses.slice(i, i + DEX_BATCH_SIZE);
    const data = await getJson('DexScreener Bankr token markets', `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`);
    const grouped = new Map();
    for (const pair of Array.isArray(data.pairs) ? data.pairs : []) {
      const addr = normalizeAddress(pair.baseToken?.address);
      if (!addr) continue;
      grouped.set(addr, betterDexPair(grouped.get(addr), pair));
    }
    for (const address of batch) {
      const key = normalizeAddress(address);
      markets.set(key, grouped.get(key) || null);
    }
  }
  return markets;
}

function backupDb() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backup = path.join(BACKUP_DIR, `terminal-before-bankr-app-sync-${stamp}.db`);
  fs.copyFileSync(TERMINAL_DB, backup);
  return backup;
}

function buildMetadata(profile) {
  return JSON.stringify({
    source: 'bankr-app',
    bankrProfileId: profile.id || null,
    bankrSlug: profile.slug || null,
    twitterUsername: profile.twitterUsername || null,
    website: profile.website || null,
    weeklyRevenueWeth: profile.weeklyRevenueWeth || null,
    productsCount: Number.isFinite(Number(profile.productsCount)) ? Number(profile.productsCount) : null,
    approved: profile.approved === true,
  });
}

function buildRevenueSources(profile) {
  return JSON.stringify({
    source: 'bankr-app',
    weeklyRevenueWeth: profile.weeklyRevenueWeth || '0',
    productsCount: Number.isFinite(Number(profile.productsCount)) ? Number(profile.productsCount) : 0,
  });
}

function assertAllProfilesPresent(db, profiles) {
  const byToken = db.prepare('SELECT id, name, platform, token_address FROM agents WHERE lower(token_address) = ? LIMIT 1');
  const missing = [];
  for (const profile of profiles) {
    const row = byToken.get(normalizeAddress(profile.tokenAddress));
    if (!row) missing.push(`${profile.projectName || profile.slug || profile.tokenSymbol} ${profile.tokenAddress}`);
  }
  if (missing.length) fail(`Bankr app profiles still missing after sync: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ` (+${missing.length - 12} more)` : ''}`);
}

function syncProfiles(db, profiles, markets) {
  const now = Math.floor(Date.now() / 1000);
  const byToken = db.prepare('SELECT * FROM agents WHERE lower(token_address) = ? ORDER BY id ASC');
  const insert = db.prepare(`INSERT INTO agents (
    address, agent_id, token_id, chain_id, name, description, image_url, metadata, platform,
    x402_supported, cred_score, cred_tier, verified, is_verified, created_at, registered_at,
    token_address, token_symbol, token_name, token_market_cap, price_change_24h, volume_24h,
    liquidity_usd, txns_24h_buys, txns_24h_sells, revenue_onchain, revenue_self_reported,
    revenue_sources, revenue_updated_at, market_enriched_at
  ) VALUES (
    @address, @agent_id, @token_id, @chain_id, @name, @description, @image_url, @metadata, 'bankr',
    0, @cred_score, @cred_tier, @verified, @is_verified, @created_at, @registered_at,
    @token_address, @token_symbol, @token_name, @token_market_cap, @price_change_24h, @volume_24h,
    @liquidity_usd, @txns_24h_buys, @txns_24h_sells, 0, @revenue_self_reported,
    @revenue_sources, @revenue_updated_at, @market_enriched_at
  )`);
  const updateBankr = db.prepare(`UPDATE agents SET
    name = @name,
    description = COALESCE(@description, description),
    image_url = COALESCE(@image_url, image_url),
    metadata = @metadata,
    platform = 'bankr',
    token_symbol = @token_symbol,
    token_name = @token_name,
    token_market_cap = @token_market_cap,
    price_change_24h = @price_change_24h,
    volume_24h = @volume_24h,
    liquidity_usd = @liquidity_usd,
    txns_24h_buys = @txns_24h_buys,
    txns_24h_sells = @txns_24h_sells,
    revenue_self_reported = @revenue_self_reported,
    revenue_sources = @revenue_sources,
    revenue_updated_at = @revenue_updated_at,
    market_enriched_at = @market_enriched_at
    WHERE id = @id`);
  const annotateCanonical = db.prepare(`UPDATE agents SET
    metadata = @metadata,
    token_market_cap = COALESCE(@token_market_cap, token_market_cap),
    price_change_24h = COALESCE(@price_change_24h, price_change_24h),
    volume_24h = COALESCE(@volume_24h, volume_24h),
    liquidity_usd = COALESCE(@liquidity_usd, liquidity_usd),
    txns_24h_buys = COALESCE(@txns_24h_buys, txns_24h_buys),
    txns_24h_sells = COALESCE(@txns_24h_sells, txns_24h_sells),
    revenue_self_reported = CASE WHEN @revenue_self_reported > COALESCE(revenue_self_reported, 0) THEN @revenue_self_reported ELSE revenue_self_reported END,
    revenue_sources = CASE WHEN @revenue_self_reported > COALESCE(revenue_self_reported, 0) THEN @revenue_sources ELSE revenue_sources END,
    revenue_updated_at = CASE WHEN @revenue_self_reported > COALESCE(revenue_self_reported, 0) THEN @revenue_updated_at ELSE revenue_updated_at END,
    market_enriched_at = @market_enriched_at
    WHERE id = @id`);

  const stats = { inserted: 0, updatedBankr: 0, annotatedCanonical: 0, skippedCanonical: 0 };
  const inserted = [];
  const updated = [];
  const canonical = [];

  const transaction = db.transaction(() => {
    for (const profile of profiles) {
      const token = normalizeAddress(profile.tokenAddress);
      const market = marketFromPair(markets.get(token), profile);
      const weeklyRevenueWeth = Number(profile.weeklyRevenueWeth || 0);
      const base = {
        address: token,
        agent_id: `bankr-${slugify(profile.slug || profile.projectName || profile.tokenSymbol)}`,
        token_id: `bankr-${slugify(profile.slug || profile.projectName || profile.tokenSymbol)}`,
        chain_id: profile.tokenChainId === 'base' ? 8453 : null,
        name: profile.projectName || profile.tokenSymbol || profile.slug,
        description: profile.description || null,
        image_url: profile.profileImageUrl || null,
        metadata: buildMetadata(profile),
        cred_score: 30,
        cred_tier: tierOf(30),
        verified: profile.approved === true ? 1 : 0,
        is_verified: profile.approved === true ? 1 : 0,
        created_at: seconds(profile.createdAt),
        registered_at: profile.createdAt || new Date().toISOString(),
        token_address: profile.tokenAddress,
        ...market,
        revenue_self_reported: Number.isFinite(weeklyRevenueWeth) ? weeklyRevenueWeth : 0,
        revenue_sources: buildRevenueSources(profile),
        revenue_updated_at: new Date().toISOString(),
        market_enriched_at: now,
      };
      const rows = byToken.all(token);
      if (!rows.length) {
        insert.run(base);
        stats.inserted++;
        inserted.push(base.name);
        continue;
      }

      const bankrRow = rows.find(row => row.platform === 'bankr' || !row.platform);
      if (bankrRow) {
        updateBankr.run({ ...base, id: bankrRow.id });
        stats.updatedBankr++;
        updated.push(base.name);
        continue;
      }

      const primary = rows[0];
      if (STRONG_PROVENANCE.has(primary.platform)) {
        annotateCanonical.run({ ...base, id: primary.id });
        stats.annotatedCanonical++;
        canonical.push(`${base.name}→${primary.platform}`);
      } else {
        stats.skippedCanonical++;
      }
    }
  });

  transaction();
  return { stats, inserted, updated, canonical };
}

(async () => {
  if (!fs.existsSync(TERMINAL_DB)) fail(`Terminal DB not found: ${TERMINAL_DB}`);
  const profiles = await fetchBankrProfiles();
  const markets = await fetchMarkets(profiles);
  const backup = backupDb();
  const db = new Database(TERMINAL_DB);
  try {
    const result = syncProfiles(db, profiles, markets);
    assertAllProfilesPresent(db, profiles);
    console.log(JSON.stringify({ backup, profiles: profiles.length, verifiedPresent: profiles.length, ...result }, null, 2));
  } finally {
    db.close();
  }
})().catch(error => fail(error.stack || error.message));
