const t = typeof window !== 'undefined' && window.__t ? window.__t : (k) => k;

const API = {
  all: '/api/all-virtual',
  penalty: '/api/penalty',
  fifa: '/api/fifa-penalty',
  pes: '/api/pes-penalty',
  match: (id) => `/api/match/${id}`,
};

function translateOutcome(outcome) {
  if (outcome === 'Équipe 1') return t('outcome_1');
  if (outcome === 'Équipe 2') return t('outcome_2');
  if (outcome === 'Nul') return t('draw');
  return outcome;
}

let currentTab = 'all';
let allData = [];
let penaltyData = null;

const $ = (id) => document.getElementById(id);
const loading = $('loading');
const error = $('error');
const matches = $('matches');
const fallbackInfo = $('fallbackInfo');

function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
  error.style.display = 'none';
}

function showError(show) {
  error.style.display = show ? 'block' : 'none';
  loading.style.display = 'none';
}

async function loadData() {
  showLoading(true);
  try {
    const [allRes, penaltyRes] = await Promise.all([
      fetch(API.all),
      fetch(API.penalty),
    ]);

    const allJson = await allRes.json();
    const penaltyJson = await penaltyRes.json();

    if (allJson.success) allData = allJson.data || [];
    if (penaltyJson.success) penaltyData = penaltyJson.data;

    render();
  } catch (err) {
    console.error(err);
    showError(true);
  } finally {
    showLoading(false);
  }
}

function getDataForTab() {
  if (currentTab === 'fifa') {
    return (penaltyData?.fifa || []).length
      ? penaltyData.fifa
      : allData.filter((m) => m.sport === 'FIFA');
  }
  if (currentTab === 'pes') {
    return (penaltyData?.pes || []).length
      ? penaltyData.pes
      : allData.filter((m) => m.sport === 'PES');
  }
  const fifa = penaltyData?.fifa || allData.filter((m) => m.sport === 'FIFA');
  const pes = penaltyData?.pes || allData.filter((m) => m.sport === 'PES');
  return [...fifa, ...pes];
}

function groupByLeague(data) {
  const groups = {};
  for (const m of data) {
    const league = m.league || t('league_other');
    if (!groups[league]) groups[league] = [];
    groups[league].push(m);
  }
  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
}

function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(sc) {
  if (!sc) return '';
  if (sc.CPS) return sc.CPS;
  if (sc.SLS) return sc.SLS;
  if (sc.FS?.S1 != null && sc.FS?.S2 != null) {
    return `⚽ ${sc.FS.S1} - ${sc.FS.S2}`;
  }
  return '';
}

function renderStatusBar(m) {
  const start = formatTime(m.startTime);
  const end = formatTime(m.endTime);
  const now = Math.floor(Date.now() / 1000);
  const started = m.startTime && now >= m.startTime;
  const finished = m.endTime && now >= m.endTime;

  let statusClass = 'status-upcoming';
  if (finished) statusClass = 'status-finished';
  else if (started) statusClass = 'status-live';

  return `
    <div class="status-bar ${statusClass}">
      <span class="status-dot"></span>
      <span>Début: ${start}</span>
      <span class="separator">→</span>
      <span>Fin: ${end}</span>
      <span class="status-label">${finished ? 'Terminé' : started ? 'En cours' : 'À venir'}</span>
    </div>
  `;
}

function renderMatch(m) {
  const pred = m.prediction;
  const favorite = pred?.prediction;
  const odds = pred?.odds || {};

  const isWin1 = favorite?.outcome === 'Équipe 1';
  const isDraw = favorite?.outcome === 'Nul';
  const isWin2 = favorite?.outcome === 'Équipe 2';
  const predLabel = favorite ? (favorite.team || translateOutcome(favorite.outcome)) : '';

  return `
    <article class="match-card" data-sport="${(m.sport || 'FIFA').toLowerCase()}">
      <div class="match-header">
        <span class="sport-badge ${(m.sport || 'FIFA').toLowerCase()}">${m.sport || 'FIFA'}</span>
        <span class="status-text">${formatStatus(m.status)}</span>
      </div>
      ${renderStatusBar(m)}
      <div class="teams">
        <div class="team">${m.team1 || '?'}</div>
        <span class="vs">
          ${m.status?.FS?.S1 != null && m.status?.FS?.S2 != null
            ? `<span class="mini-score">${m.status.FS.S1}<span class="score-colon">:</span>${m.status.FS.S2}</span>`
            : 'VS'}
        </span>
        <div class="team">${m.team2 || '?'}</div>
      </div>
      <div class="odds-row">
        <div class="odd ${isWin1 ? 'predicted' : ''}">
          <div class="label">1</div>
          <div>${odds.win1 != null ? odds.win1.toFixed(2) : '-'}</div>
        </div>
        <div class="odd ${isDraw ? 'predicted' : ''}">
          <div class="label">X</div>
          <div>${odds.draw != null ? odds.draw.toFixed(2) : '-'}</div>
        </div>
        <div class="odd ${isWin2 ? 'predicted' : ''}">
          <div class="label">2</div>
          <div>${odds.win2 != null ? odds.win2.toFixed(2) : '-'}</div>
        </div>
      </div>
      ${
        favorite
          ? `
      <div class="prediction-box">
        <span><strong>Prédiction :</strong> ${favorite.team || favorite.outcome}</span>
        <span class="confidence">Confiance: ${favorite.confidence || 0}%</span>
        <span class="confidence">Cote: ${favorite.odds?.toFixed(2) || '-'}</span>
      </div>
      `
          : ''
      }
      <a href="/match?id=${m.id}" class="btn-details">Détails</a>
    </article>
  `;
}

function render() {
  const data = getDataForTab();
  const byLeague = groupByLeague(data);

  if (!data || data.length === 0) {
    const label = currentTab === 'fifa' ? t('tab_fifa') : currentTab === 'pes' ? t('tab_pes') : '';
    const hint = currentTab === 'pes' ? t('pes_unavailable') : t('try_later');
    matches.innerHTML = `
      <div class="empty-state">
        <p>${t('no_match')}${label ? ' ' + label : ''} ${t('no_match_found')}</p>
        <p>${hint}</p>
      </div>
    `;
  } else {
    matches.innerHTML = byLeague
      .map(
        ([league, items]) => `
        <div class="league-group">
          <h3 class="league-title">${league}</h3>
          <div class="league-matches">${items.map(renderMatch).join('')}</div>
        </div>
      `
      )
      .join('');
  }

  const totalPenalty = (penaltyData?.fifa?.length || 0) + (penaltyData?.pes?.length || 0);
  fallbackInfo.style.display = totalPenalty === 0 && allData.length > 0 ? 'block' : 'none';
  if (fallbackInfo.style.display === 'block') fallbackInfo.textContent = t('fallback_no_penalty');
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    render();
  });
});

function applyTranslations() {
  const nav = document.getElementById('navTabs');
  if (nav) {
    const allBtn = nav.querySelector('[data-tab="all"]');
    const fifaBtn = nav.querySelector('[data-tab="fifa"]');
    const pesBtn = nav.querySelector('[data-tab="pes"]');
    if (allBtn) allBtn.textContent = t('tab_all');
    if (fifaBtn) fifaBtn.textContent = t('tab_fifa');
    if (pesBtn) pesBtn.textContent = t('tab_pes');
  }
  const loadingText = document.getElementById('loadingText');
  if (loadingText) loadingText.textContent = t('loading');
  const errorText = document.getElementById('errorText');
  if (errorText) errorText.textContent = t('error_load');
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) retryBtn.textContent = t('retry');
  const footerDisclaimer = document.getElementById('footerDisclaimer');
  if (footerDisclaimer) footerDisclaimer.textContent = t('footer_disclaimer');
  const footerHome = document.getElementById('footerHome');
  if (footerHome) footerHome.textContent = t('home');
  const footerList = document.getElementById('footerList');
  if (footerList) footerList.textContent = t('list_matches');
}

applyTranslations();
loadData();
setInterval(loadData, 60000);
