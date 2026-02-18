const express = require("express");
const path = require("path");
const { API_URL, getPenaltyMatches, getStructure, getMatchPredictionDetails, getCouponSelection, validateCouponTicket } = require("./services/liveFeed");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3029;
const MAX_PORT_TRIES = 20;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

function initialsFromName(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function colorFromName(name = "", salt = 0) {
  let h = 0;
  const s = `${name}|${salt}`;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 78% 46%)`;
}

function normalizeTeamKey(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TEAM_COLOR_MAP = new Map([
  ["manchester city", ["#6CABDD", "#1C2C5B"]],
  ["borussia dortmund", ["#FDE100", "#111111"]],
  ["paris saint germain", ["#004170", "#DA1F3D"]],
  ["liverpool", ["#C8102E", "#00B2A9"]],
  ["arsenal", ["#EF0107", "#063672"]],
  ["tottenham hotspur", ["#132257", "#FFFFFF"]],
  ["chelsea", ["#034694", "#FFFFFF"]],
  ["newcastle united", ["#241F20", "#FFFFFF"]],
  ["manchester united", ["#DA291C", "#FBE122"]],
  ["aston villa", ["#670E36", "#95BFE5"]],
  ["brighton et hove albion", ["#0057B8", "#FFFFFF"]],
  ["fulham", ["#111111", "#CC0000"]],
  ["brentford", ["#D71920", "#111111"]],
  ["west ham united", ["#7A263A", "#1BB1E7"]],
  ["athletic bilbao", ["#D0102A", "#FFFFFF"]],
  ["atletico madrid", ["#C8102E", "#1B3E8A"]],
  ["club atletico de madrid", ["#C8102E", "#1B3E8A"]],
  ["real valladolid", ["#6A2C91", "#FFFFFF"]],
  ["espanyol", ["#0072CE", "#FFFFFF"]],
  ["fiorentine", ["#5E3A8C", "#FFFFFF"]],
  ["fiorentina", ["#5E3A8C", "#FFFFFF"]],
  ["milano", ["#D71920", "#111111"]],
  ["napoli", ["#008FD5", "#FFFFFF"]],
  ["udinese calcio", ["#111111", "#FFFFFF"]],
  ["bergamo calcio", ["#0057B8", "#111111"]],
  ["bologna 1909", ["#A50021", "#12326B"]],
  ["leipzig", ["#E30613", "#002B5C"]],
  ["eintracht", ["#D00027", "#111111"]],
  ["freiburg", ["#111111", "#E30613"]],
  ["werder bremen", ["#008A4B", "#FFFFFF"]],
  ["vfl bochum", ["#0054A6", "#FFFFFF"]],
  ["borussia monchengladbach", ["#111111", "#FFFFFF"]],
  ["ajax", ["#D2122E", "#FFFFFF"]],
  ["anderlecht", ["#4A1F7A", "#FFFFFF"]],
  ["galatasaray", ["#A91917", "#FFB300"]],
  ["olympiacos", ["#D4002A", "#FFFFFF"]],
  ["olympique lyonnais", ["#0E3386", "#DA291C"]],
  ["rangers", ["#005EB8", "#FFFFFF"]],
  ["sporting clube de portugal", ["#00883F", "#FFFFFF"]],
  ["villarreal", ["#FFE100", "#0052A5"]],
]);

function teamColors(name = "") {
  const key = normalizeTeamKey(name);
  for (const [teamKey, colors] of TEAM_COLOR_MAP.entries()) {
    if (key === teamKey || key.includes(teamKey) || teamKey.includes(key)) return colors;
  }
  return [colorFromName(name, 1), colorFromName(name, 2)];
}

app.get("/api/team-badge", (req, res) => {
  const name = String(req.query.name || "Equipe").trim();
  const initials = initialsFromName(name).slice(0, 2);
  const [c1, c2] = teamColors(name);
  const safeTitle = name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="61" fill="#fff" stroke="#e5e9f1" stroke-width="6"/>
  <circle cx="64" cy="64" r="51" fill="url(#g)"/>
  <text x="64" y="74" text-anchor="middle" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#fff">${initials}</text>
</svg>`;

  res.set("Content-Type", "image/svg+xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(svg);
});

app.get("/api/logo/:fileName", async (req, res) => {
  const raw = String(req.params.fileName || "").trim();
  let safe = raw;
  try {
    safe = decodeURIComponent(raw);
  } catch (_error) {
    return res.status(400).send("Nom de logo invalide.");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(safe)) {
    return res.status(400).send("Nom de logo invalide.");
  }

  const fileCandidates = safe.includes(".") ? [safe] : [safe, `${safe}.png`];
  const baseUrls = [
    "https://1xbet.com/LineFeedImages/",
    "https://1xbet.com/linefeed/images/",
    "https://1xbet.com/genfiles/team/",
    "https://1xbet.com/genfiles/teams/",
  ];

  for (const file of fileCandidates) {
    for (const base of baseUrls) {
      const url = `${base}${file}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          headers: {
            "user-agent": "Mozilla/5.0",
            accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            referer: "https://1xbet.com/",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) continue;
        const type = response.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await response.arrayBuffer());
        res.set("Content-Type", type);
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(buffer);
      } catch (_error) {
        continue;
      }
    }
  }

  res.status(404).send("Logo introuvable.");
});

app.get("/api/structure", async (_req, res) => {
  try {
    const structure = await getStructure();
    res.json({ success: true, source: API_URL, ...structure });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible d'analyser la structure JSON.",
      error: error.message,
    });
  }
});

app.get("/api/matches", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    res.json({ success: true, source: API_URL, ...data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de recuperer les matchs penalty FIFA virtuel.",
      error: error.message,
    });
  }
});

app.get("/api/matches/:id/details", async (req, res) => {
  try {
    const details = await getMatchPredictionDetails(req.params.id);
    res.json({ success: true, source: API_URL, ...details });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de calculer les predictions unifiees pour ce match.",
      error: error.message,
    });
  }
});

app.get("/api/coupon", async (req, res) => {
  try {
    const size = Number(req.query.size) || 3;
    const league = req.query.league ? String(req.query.league) : "all";
    const coupon = await getCouponSelection(size, league);
    res.json({ success: true, source: API_URL, ...coupon });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de generer le coupon optimise.",
      error: error.message,
    });
  }
});

app.post("/api/coupon/validate", async (req, res) => {
  try {
    const driftThresholdPercent = Number(req.body?.driftThresholdPercent) || 6;
    const report = await validateCouponTicket(req.body || {}, { driftThresholdPercent });
    res.json({ success: true, source: API_URL, ...report });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de valider le ticket coupon.",
      error: error.message,
    });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route API introuvable.",
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(startPort, triesLeft = MAX_PORT_TRIES) {
  const server = app.listen(startPort, () => {
    console.log(`Serveur actif: http://localhost:${startPort}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && triesLeft > 0) {
      const nextPort = startPort + 1;
      console.warn(`Port ${startPort} occupe, tentative sur ${nextPort}...`);
      startServer(nextPort, triesLeft - 1);
      return;
    }

    console.error("Impossible de demarrer le serveur:", error.message);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT);
