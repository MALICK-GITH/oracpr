const AUTO_REFRESH_SECONDS = 60;
const DRIFT_THRESHOLD_PERCENT = 8;

let pulseChart = null;
let currentMatchId = null;
let refreshIntervalId = null;
let countdownIntervalId = null;
let countdown = AUTO_REFRESH_SECONDS;
let previousOdds = null;
let loading = false;

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatOdd(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function chartTextColor() {
  return "#d8e7f8";
}

function chartGridColor() {
  return "rgba(255,255,255,0.12)";
}

function updateRefreshBadge() {
  const el = document.getElementById("refreshBadge");
  if (el) el.textContent = `Auto-refresh dans ${countdown}s`;
}

function startAutoRefresh() {
  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(() => {
      countdown = AUTO_REFRESH_SECONDS;
      updateRefreshBadge();
      loadData("auto");
    }, AUTO_REFRESH_SECONDS * 1000);
  }
  if (!countdownIntervalId) {
    countdownIntervalId = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
      updateRefreshBadge();
    }, 1000);
  }
}

function impliedProbabilities(odds1x2) {
  const home = toNumber(odds1x2?.home, 0);
  const draw = toNumber(odds1x2?.draw, 0);
  const away = toNumber(odds1x2?.away, 0);
  if (!(home > 0 && draw > 0 && away > 0)) return { home: 33.3, draw: 33.3, away: 33.4 };
  const ph = 1 / home;
  const pd = 1 / draw;
  const pa = 1 / away;
  const sum = ph + pd + pa;
  return {
    home: Number(((ph / sum) * 100).toFixed(2)),
    draw: Number(((pd / sum) * 100).toFixed(2)),
    away: Number(((pa / sum) * 100).toFixed(2)),
  };
}

function extractOdds(match) {
  return {
    home: toNumber(match?.odds1x2?.home, 0),
    draw: toNumber(match?.odds1x2?.draw, 0),
    away: toNumber(match?.odds1x2?.away, 0),
  };
}

function computeDrift(previous, next) {
  if (!previous) return [];
  const labels = {
    home: "Victoire domicile (1)",
    draw: "Match nul (X)",
    away: "Victoire exterieur (2)",
  };
  const drifts = [];
  for (const key of ["home", "draw", "away"]) {
    const oldVal = toNumber(previous[key], 0);
    const newVal = toNumber(next[key], 0);
    if (oldVal <= 0 || newVal <= 0) continue;
    const pct = Math.abs(((newVal - oldVal) / oldVal) * 100);
    if (pct >= DRIFT_THRESHOLD_PERCENT) {
      drifts.push({
        label: labels[key],
        oldVal,
        newVal,
        pct: Number(pct.toFixed(1)),
      });
    }
  }
  return drifts;
}

function renderDriftAlert(drifts) {
  const box = document.getElementById("driftAlert");
  if (!box) return;
  if (!drifts.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const rows = drifts
    .map((d) => `<li>${d.label}: ${formatOdd(d.oldVal)} -> ${formatOdd(d.newVal)} (${d.pct}%)</li>`)
    .join("");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h2 class="drift-title">Alerte Drift Cotes</h2>
    <ul class="drift-list">${rows}</ul>
  `;
}

function renderMaster(master, analyse) {
  const el = document.getElementById("master");
  el.innerHTML = `
    <h2>Decision Finale (Maitre)</h2>
    <div class="grid2">
      <div class="box"><strong>Pari choisi</strong><div>${master.pari_choisi || "Aucun"}</div></div>
      <div class="box"><strong>Action</strong><div>${master.action || "AUCUNE"}</div></div>
      <div class="box"><strong>Confiance</strong><div>${master.confiance_numerique ?? 0}%</div></div>
      <div class="box"><strong>Consensus bots</strong><div>${analyse.consensus || "N/A"}</div></div>
    </div>
  `;
}

function renderBots(bots) {
  const el = document.getElementById("bots");
  const rows = Object.values(bots || [])
    .map((b) => {
      const picks = Array.isArray(b.paris_recommandes)
        ? b.paris_recommandes
            .map((p) => `<li>${p.nom} | cote ${formatOdd(Number(p.cote))} | confiance ${p.confiance ?? 0}%</li>`)
            .join("")
        : "";
      return `
      <div class="box">
        <strong>${b.bot_name}</strong>
        <div>Confiance globale: ${b.confiance_globale || 0}%</div>
        <div>Top paris: ${Array.isArray(b.paris_recommandes) ? b.paris_recommandes.length : 0}</div>
        <ul>${picks || "<li>Aucun pari retenu</li>"}</ul>
      </div>
    `;
    })
    .join("");
  el.innerHTML = `<h2>Confiance des Bots</h2><div class="grid2">${rows || "<div class='box'>Aucun bot</div>"}</div>`;
}

function renderTop3(list) {
  const el = document.getElementById("top3");
  const li = (list || [])
    .map((x) => `<li>${x.pari} | cote ${formatOdd(x.cote)} | score ${x.score_composite}% | value ${x.value}% | risque ${x.risque}</li>`)
    .join("");
  el.innerHTML = `<h2>Top 3 Recommandations</h2><ul>${li || "<li>Aucune recommandation</li>"}</ul>`;
}

function renderMarkets(markets) {
  const el = document.getElementById("markets");
  const li = (markets || [])
    .slice(0, 50)
    .map((m) => `<li>${m.nom} | cote ${formatOdd(m.cote)} | type ${m.type}</li>`)
    .join("");
  el.innerHTML = `<h2>Marches Analyses</h2><ul>${li || "<li>Aucun marche</li>"}</ul>`;
}

function renderPulseChart(data) {
  const match = data.match || {};
  const prediction = data.prediction || {};
  const bots = Object.values(prediction.bots || {});
  const probs = impliedProbabilities(match.odds1x2);
  const avgBotConfidence =
    bots.length > 0
      ? Number((bots.reduce((acc, b) => acc + toNumber(b.confiance_globale, 0), 0) / bots.length).toFixed(2))
      : 0;
  const masterConfidence = toNumber(prediction?.maitre?.decision_finale?.confiance_numerique, 0);

  const labels = ["Prob 1", "Prob X", "Prob 2", "Conf Bots Moy", "Conf Maitre"];
  const probLine = [probs.home, probs.draw, probs.away, avgBotConfidence, masterConfidence];
  const oddBars = [
    toNumber(match.odds1x2?.home, 0),
    toNumber(match.odds1x2?.draw, 0),
    toNumber(match.odds1x2?.away, 0),
    null,
    null,
  ];

  const ctx = document.getElementById("chartPulse");
  if (!ctx || !window.Chart) return;
  if (pulseChart) {
    try {
      pulseChart.destroy();
    } catch {}
  }

  pulseChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "line",
          label: "Indice confiance/probabilite (%)",
          data: probLine,
          yAxisID: "yPercent",
          borderColor: "#55b0e8",
          backgroundColor: "rgba(85,176,232,0.18)",
          fill: true,
          tension: 0.28,
        },
        {
          type: "bar",
          label: "Cotes reelles 1X2",
          data: oddBars,
          yAxisID: "yOdds",
          backgroundColor: ["#ea7166", "#64d18c", "#9a6fd6", "transparent", "transparent"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yPercent: {
          type: "linear",
          position: "left",
          min: 0,
          max: 100,
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() },
        },
        yOdds: {
          type: "linear",
          position: "right",
          ticks: { color: chartTextColor() },
          grid: { drawOnChartArea: false },
        },
        x: {
          ticks: { color: chartTextColor() },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
      plugins: {
        legend: { labels: { color: chartTextColor() } },
      },
    },
  });
}

async function loadData(trigger = "manual") {
  if (loading || !currentMatchId) return;
  loading = true;
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(currentMatchId)}/details`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Erreur API");

    const match = data.match || {};
    document.getElementById("title").textContent = `${match.teamHome} vs ${match.teamAway}`;
    document.getElementById("sub").textContent = `${match.league} | marche(s): ${data.bettingMarkets?.length || 0}${trigger === "auto" ? " | mise a jour auto" : ""}`;

    renderMaster(data.prediction?.maitre?.decision_finale || {}, data.prediction?.maitre?.analyse_bots || {});
    renderPulseChart(data);
    renderBots(data.prediction?.bots || {});
    renderTop3(data.prediction?.analyse_avancee?.top_3_recommandations || []);
    renderMarkets(data.bettingMarkets || []);

    const currentOdds = extractOdds(match);
    const drifts = computeDrift(previousOdds, currentOdds);
    renderDriftAlert(drifts);
    previousOdds = currentOdds;
  } catch (error) {
    document.getElementById("title").textContent = "Erreur de chargement";
    document.getElementById("sub").textContent = error.message;
  } finally {
    loading = false;
  }
}

function init() {
  currentMatchId = qs("id");
  if (!currentMatchId) {
    document.getElementById("title").textContent = "Match non specifie";
    document.getElementById("sub").textContent = "Ajoute ?id=...";
    return;
  }
  countdown = AUTO_REFRESH_SECONDS;
  updateRefreshBadge();
  loadData("manual");
  startAutoRefresh();
}

init();
