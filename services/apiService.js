const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const config = require('../config');

const buildUrl = (sportId, count = 100, extra = {}) => {
  const params = {
    sports: sportId,
    count,
    lng: 'fr',
    mode: 4,
    country: 96,
    getEmpty: true,
    virtualSports: true,
    noFilterBlockEvent: true,
    ...extra,
  };
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.set(k, String(v));
  });
  return `${config.api.baseUrl}?${q}`;
};

const fetchVirtualMatches = async (sportId, opts = {}) => {
  try {
    const url = buildUrl(sportId, opts.count, opts);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(config.api.timeout),
    });
    const data = await res.json();
    return data?.Success ? data.Value || [] : [];
  } catch (err) {
    console.error(`Erreur fetch sport ${sportId}:`, err.message);
    return [];
  }
};

/** PES : essaie id 144 puis 86 (Get1x2_VZip peut accepter l’un ou l’autre), fusionne et déduplique */
const fetchVirtualMatchesPes = async (pesConfig) => {
  const ids = [pesConfig.id];
  if (pesConfig.idFallback != null) ids.push(pesConfig.idFallback);
  const seen = new Set();
  const out = [];
  const extra = pesConfig.gr != null ? { gr: pesConfig.gr } : {};
  for (const sportId of ids) {
    const list = await fetchVirtualMatches(sportId, extra);
    for (const e of list) {
      const key = String(e.I);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(e);
      }
    }
  }
  return out;
};

const isPenaltyMatch = (event, keywords) => {
  const league = (event.L || '') + (event.LE || '') + (event.LR || '');
  const text = league.toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
};

module.exports = {
  fetchVirtualMatches,
  fetchVirtualMatchesPes,
  isPenaltyMatch,
};
