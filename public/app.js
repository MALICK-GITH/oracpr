let allMatches = [];
let currentModeLabel = "";

function formatTime(unixSeconds) {
  if (!unixSeconds) return "Heure non disponible";
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOdd(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function scoreText(score) {
  if (!score || typeof score !== "object" || Object.keys(score).length === 0) return "Score: -";
  const h = score.S1 ?? score.SA ?? score.H ?? score.Home ?? "?";
  const a = score.S2 ?? score.SB ?? score.A ?? score.Away ?? "?";
  return `Score: ${h}-${a}`;
}

function extractScore(score) {
  if (!score || typeof score !== "object") return { home: "?", away: "?" };
  const home = score.S1 ?? score.SA ?? score.H ?? score.Home ?? "?";
  const away = score.S2 ?? score.SB ?? score.A ?? score.Away ?? "?";
  return { home, away };
}

function teamBadge(name) {
  const clean = String(name || "").trim();
  if (!clean) return "??";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createTeamLogo(name, logoUrl, fallbackUrl, isAway = false) {
  const fallback = teamBadge(name);
  const safeName = escapeHtml(name);
  const awayClass = isAway ? " away" : "";
  if (!logoUrl) {
    return `<div class="team-logo logo-fallback${awayClass}"><span class="team-logo-fallback">${fallback}</span></div>`;
  }
  const safeFallbackUrl = fallbackUrl ? ` data-fallback-src="${escapeHtml(fallbackUrl)}"` : "";
  return `
    <div class="team-logo${awayClass}">
      <img class="team-logo-img" src="${logoUrl}" alt="Logo ${safeName}" loading="lazy"${safeFallbackUrl} />
      <span class="team-logo-fallback">${fallback}</span>
    </div>
  `;
}

function createStat(title, value) {
  const el = document.createElement("article");
  el.className = "stat-box";
  el.innerHTML = `<small>${title}</small><strong>${value}</strong>`;
  return el;
}

function uniqueLeagues(matches) {
  const map = new Map();
  matches.forEach((match) => {
    const league = String(match.league || "").trim();
    if (league && !map.has(league.toLowerCase())) map.set(league.toLowerCase(), league);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "fr"));
}

function populateLeagueFilter(matches) {
  const select = document.getElementById("leagueSelect");
  const currentValue = select.value || "all";
  const leagues = uniqueLeagues(matches);

  select.innerHTML = '<option value="all">Toutes les ligues</option>';
  leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league;
    option.textContent = league;
    select.appendChild(option);
  });

  if ([...select.options].some((opt) => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

function createMatchCard(match, index) {
  const card = document.createElement("article");
  card.className = "match-card";
  card.style.animationDelay = `${Math.min(index * 0.04, 0.6)}s`;
  const score = extractScore(match.score);
  const status = match.statusText || "A venir";

  const detailLink = document.createElement("a");
  detailLink.className = "detail-btn";
  detailLink.href = `/match.html?id=${encodeURIComponent(match.id)}`;
  detailLink.textContent = "Detail predictions";

  card.innerHTML = `
    <div class="league-row">
      <p class="league">${match.league || "Ligue virtuelle"}</p>
      <span class="status-pill">${status}</span>
    </div>
    <div class="scoreboard">
      <div class="team-col">
        ${createTeamLogo(match.teamHome, match.teamHomeLogo, match.teamHomeLogoFallback)}
        <p class="team-name">${match.teamHome}</p>
      </div>
      <div class="score-center">${score.home} - ${score.away}</div>
      <div class="team-col">
        ${createTeamLogo(match.teamAway, match.teamAwayLogo, match.teamAwayLogoFallback, true)}
        <p class="team-name">${match.teamAway}</p>
      </div>
    </div>
    <div class="odds-row">
      <div class="odd-box"><span>${match.teamHome}</span><strong>${formatOdd(match.odds1x2?.home)}</strong></div>
      <div class="odd-box"><span>Nul</span><strong>${formatOdd(match.odds1x2?.draw)}</strong></div>
      <div class="odd-box"><span>${match.teamAway}</span><strong>${formatOdd(match.odds1x2?.away)}</strong></div>
    </div>
    <p class="kickoff">Coup d'envoi: ${formatTime(match.startTimeUnix)} | ${scoreText(match.score)}</p>
  `;

  card.appendChild(detailLink);
  card.querySelectorAll(".team-logo-img").forEach((img) => {
    img.addEventListener("error", () => {
      const wrapper = img.closest(".team-logo");
      const fallbackSrc = img.getAttribute("data-fallback-src");
      if (fallbackSrc && img.src !== fallbackSrc) {
        img.src = fallbackSrc;
        img.removeAttribute("data-fallback-src");
        return;
      }
      if (wrapper) wrapper.classList.add("logo-fallback");
    });
  });
  return card;
}

function renderMatches() {
  const subTitle = document.getElementById("subTitle");
  const matchesWrap = document.getElementById("matches");
  const emptyState = document.getElementById("emptyState");
  const leagueSelect = document.getElementById("leagueSelect");
  const selectedLeague = leagueSelect.value;

  const filtered =
    selectedLeague === "all"
      ? allMatches
      : allMatches.filter((match) => match.league === selectedLeague);

  const leagueLabel = selectedLeague === "all" ? "toutes ligues" : `ligue: ${selectedLeague}`;
  subTitle.textContent = `${filtered.length} match(s) (${leagueLabel}) - ${currentModeLabel}`;

  matchesWrap.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length > 0);
  if (filtered.length > 0) {
    filtered.forEach((match, index) => matchesWrap.appendChild(createMatchCard(match, index)));
  }
}

async function loadMatches() {
  const subTitle = document.getElementById("subTitle");
  const statsWrap = document.getElementById("stats");
  const emptyState = document.getElementById("emptyState");
  const updatedAt = document.getElementById("updatedAt");

  subTitle.textContent = "Chargement en cours...";
  statsWrap.innerHTML = "";
  emptyState.classList.add("hidden");

  try {
    const res = await fetch("/api/matches", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Reponse API invalide");

    allMatches = Array.isArray(data.matches) ? data.matches : [];
    const mode = data.filterMode === "keyword-penalty" ? "filtre mot-cle" : "fallback groupe gr=285";
    currentModeLabel = `mode: ${mode}`;

    statsWrap.appendChild(createStat("Total API", data.totalFromApi ?? "-"));
    statsWrap.appendChild(createStat("Sport 85", data.totalSport85 ?? "-"));
    statsWrap.appendChild(createStat("Penalty", data.totalPenalty ?? "-"));
    statsWrap.appendChild(createStat("Ligues", uniqueLeagues(allMatches).length));

    populateLeagueFilter(allMatches);
    renderMatches();
    updatedAt.textContent = `Derniere mise a jour: ${new Date(data.fetchedAt).toLocaleString("fr-FR")}`;
  } catch (error) {
    subTitle.textContent = "Erreur de chargement";
    emptyState.classList.remove("hidden");
    emptyState.textContent = `Erreur: ${error.message}`;
    updatedAt.textContent = "";
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadMatches);
document.getElementById("leagueSelect").addEventListener("change", renderMatches);
loadMatches();
