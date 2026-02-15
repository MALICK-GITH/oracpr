const express = require('express');
const path = require('path');
const config = require('./config');
const { fetchVirtualMatches, fetchVirtualMatchesPes, isPenaltyMatch } = require('./services/apiService');
const { predict, getUltimatePredictions } = require('./services/predictionService');
const { getAlternativePredictionsOnly } = require('./services/alternativePredictionService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route API - Matches penalty FIFA
app.get('/api/fifa-penalty', async (req, res) => {
  try {
    const events = await fetchVirtualMatches(config.sports.fifa.id);
    const penaltyMatches = events.filter((e) =>
      isPenaltyMatch(e, config.sports.fifa.keywords)
    );
    const results = penaltyMatches.map((event) => ({
      id: event.I,
      team1: event.O1,
      team2: event.O2,
      league: event.L,
      status: event.SC,
      startTime: event.S,
      prediction: predict(event),
    }));
    res.json({ success: true, data: results, total: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route API - Matches PES (penalty si trouvés, sinon tous les matchs PES virtuels)
app.get('/api/pes-penalty', async (req, res) => {
  try {
    const events = await fetchVirtualMatchesPes(config.sports.pes);
    const penaltyMatches = events.filter((e) =>
      isPenaltyMatch(e, config.sports.pes.keywords)
    );
    const toUse = penaltyMatches.length > 0 ? penaltyMatches : events;
    const results = toUse.map((event) => ({
      id: event.I,
      team1: event.O1,
      team2: event.O2,
      league: event.L,
      status: event.SC,
      startTime: event.S,
      prediction: predict(event),
    }));
    res.json({ success: true, data: results, total: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route API - Tous les matches virtuels (FIFA + PES) avec filtre penalty ; si aucun PES penalty, on renvoie tous les PES
app.get('/api/penalty', async (req, res) => {
  try {
    const [fifaEvents, pesEvents] = await Promise.all([
      fetchVirtualMatches(config.sports.fifa.id),
      fetchVirtualMatchesPes(config.sports.pes),
    ]);

    const allKeywords = [
      ...config.sports.fifa.keywords,
      ...config.sports.pes.keywords,
    ];
    const penalty = (e) => isPenaltyMatch(e, allKeywords);

    const fifa = fifaEvents.filter(penalty).map((e) => ({
      ...formatMatch(e, predict(e)),
      sport: 'FIFA',
    }));
    const pesFiltered = pesEvents.filter(penalty);
    const pes = (pesFiltered.length > 0 ? pesFiltered : pesEvents).map((e) => ({
      ...formatMatch(e, predict(e)),
      sport: 'PES',
    }));

    res.json({
      success: true,
      data: { fifa, pes },
      total: { fifa: fifa.length, pes: pes.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Si peu de matches "Penalty" trouvés, on expose aussi tous les FIFA + PES virtuels
app.get('/api/all-virtual', async (req, res) => {
  try {
    const [fifaEvents, pesEvents] = await Promise.all([
      fetchVirtualMatches(config.sports.fifa.id),
      fetchVirtualMatchesPes(config.sports.pes),
    ]);
    const fifa = fifaEvents.map((e) => ({
      ...formatMatch(e, predict(e)),
      sport: 'FIFA',
    }));
    const pes = pesEvents.map((e) => ({
      ...formatMatch(e, predict(e)),
      sport: 'PES',
    }));
    const results = [...fifa, ...pes];
    res.json({ success: true, data: results, total: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const MATCH_DURATION_SEC = (config.prediction?.matchDurationMinutes || 7) * 60;

function formatMatch(event, pred) {
  const startTime = event.S ? parseInt(event.S, 10) : null;
  const endTime = startTime ? startTime + MATCH_DURATION_SEC : null;
  return {
    id: event.I,
    team1: event.O1,
    team2: event.O2,
    league: event.L,
    status: event.SC,
    startTime,
    endTime,
    prediction: pred,
    ultimatePredictions: getUltimatePredictions(event),
    alternativePredictions: getAlternativePredictionsOnly(event),
    raw: event,
  };
}

app.get('/api/match/:id', async (req, res) => {
  try {
    const events = await fetchVirtualMatches(config.sports.fifa.id);
    const pesEvents = await fetchVirtualMatchesPes(config.sports.pes);
    const all = [...events, ...pesEvents];
    const event = all.find((e) => String(e.I) === String(req.params.id));
    if (!event) {
      return res.status(404).json({ success: false, error: 'Match introuvable' });
    }
    const sport = events.find((e) => String(e.I) === String(req.params.id)) ? 'FIFA' : 'PES';
    const formatted = {
      ...formatMatch(event, predict(event)),
      sport,
    };
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/match', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'match.html'));
});

app.listen(PORT, () => {
  console.log(`\n Penalty Predictor - FIFA & PES`);
  console.log(` http://localhost:${PORT}\n`);
});
