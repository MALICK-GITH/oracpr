const config = require('../config');

/**
 * Extrait les cotes 1X2 d'un événement
 * G=1, T=1 (1), T=2 (X), T=3 (2)
 */
const extract1x2Odds = (event) => {
  const odds = { win1: null, draw: null, win2: null };
  if (!event.E || !Array.isArray(event.E)) return odds;

  for (const o of event.E) {
    if (o.G !== 1) continue;
    if (o.T === 1) odds.win1 = parseFloat(o.C);
    if (o.T === 2) odds.draw = parseFloat(o.C);
    if (o.T === 3) odds.win2 = parseFloat(o.C);
  }
  return odds;
};

/**
 * Probabilités implicites à partir des cotes (avec marge bookmaker)
 */
const oddsToImpliedProb = (odds) => {
  const probs = {};
  let total = 0;

  for (const [key, value] of Object.entries(odds)) {
    if (value && value > 0) {
      probs[key] = 1 / value;
      total += probs[key];
    } else {
      probs[key] = 0;
    }
  }

  // Normaliser pour retirer la marge (probas équitables)
  if (total > 0) {
    for (const key of Object.keys(probs)) {
      probs[key] = probs[key] / total;
    }
  }
  return probs;
};

/**
 * Valeur prédictive : compare probabilité implicite vs notre estimation
 * Retourne un "indice de valeur" pour chaque issue
 */
const computeValue = (probs, odds) => {
  const value = {};
  for (const [key, prob] of Object.entries(probs)) {
    const odd = odds[key];
    if (odd && odd > 0 && prob > 0) {
      // Si prob > 1/odd, l'odds est "sous-estimé" par le bookmaker
      const fairOdd = 1 / prob;
      value[key] = {
        probability: Math.round(prob * 100) / 100,
        fairOdd: Math.round(fairOdd * 100) / 100,
        valueIndex: Math.round((fairOdd / odd - 1) * 100) / 100,
      };
    } else {
      value[key] = { probability: 0, fairOdd: null, valueIndex: 0 };
    }
  }
  return value;
};

/**
 * Prédiction principale : favori + niveau de confiance
 */
const predict = (event) => {
  const odds = extract1x2Odds(event);
  const probs = oddsToImpliedProb(odds);
  const value = computeValue(probs, odds);

  const entries = [
    { outcome: 'Équipe 1', key: 'win1', team: event.O1 },
    { outcome: 'Nul', key: 'draw', team: null },
    { outcome: 'Équipe 2', key: 'win2', team: event.O2 },
  ];

  const sorted = entries
    .map((e) => ({
      ...e,
      odds: odds[e.key],
      prob: probs[e.key],
      valueData: value[e.key],
    }))
    .filter((e) => e.odds != null)
    .sort((a, b) => (b.prob || 0) - (a.prob || 0));

  const favorite = sorted[0];
  const confidence =
    favorite && favorite.prob
      ? Math.min(100, Math.round(favorite.prob * 100))
      : 0;

  return {
    odds,
    probs,
    value,
    prediction: favorite
      ? {
          outcome: favorite.outcome,
          team: favorite.team,
          odds: favorite.odds,
          probability: favorite.prob,
          confidence,
          valueIndex: favorite.valueData?.valueIndex,
        }
      : null,
    allOutcomes: sorted,
  };
};

/**
 * Paris ultime : options avec cote >= 2.0, triées par valeur
 * Priorité : meilleur rapport probabilité / cote
 */
const getUltimatePredictions = (event) => {
  const pred = predict(event);
  const minOdds = config.prediction.ultimateMinOdds || 2.0;

  const entries = [
    { outcome: 'Équipe 1', key: 'win1', team: event.O1 },
    { outcome: 'Nul', key: 'draw', team: null },
    { outcome: 'Équipe 2', key: 'win2', team: event.O2 },
  ];

  const withOdds = entries
    .map((e) => ({
      ...e,
      odds: pred.odds[e.key],
      prob: pred.probs[e.key],
      valueData: pred.value[e.key],
    }))
    .filter((e) => e.odds != null && e.odds >= minOdds)
    .sort((a, b) => {
      const scoreA = (a.valueData?.valueIndex || 0) + (a.prob || 0) * 0.5;
      const scoreB = (b.valueData?.valueIndex || 0) + (b.prob || 0) * 0.5;
      return scoreB - scoreA;
    });

  return {
    options: withOdds,
    recommended: withOdds[0] || null,
  };
};

module.exports = {
  extract1x2Odds,
  oddsToImpliedProb,
  predict,
  getUltimatePredictions,
};
