/**
 * Service de prédictions PARIS ALTERNATIFS UNIQUEMENT
 * Ne prédit que les paris alternatifs (totaux, handicaps, pair/impair, etc.)
 * Utilise SystemePredictionParisAlternatifs - aucun 1X2.
 */
const { SystemePredictionParisAlternatifs, calculerProbabilitesDepuisCotes, calculerForceEquipeDepuisCotes } = require('../systeme_predictions');
const { extract1x2Odds, oddsToImpliedProb } = require('./predictionService');

/**
 * Extrait les paris alternatifs depuis event.E (1xbet API)
 * G=1 = 1X2, on ignore. G>1 = marchés alternatifs.
 */
function extractAlternativeMarkets(event) {
  const paris = [];
  if (!event?.E || !Array.isArray(event.E)) return paris;

  for (const o of event.E) {
    if (o.G === 1) continue; // 1X2 ignoré
    const cote = parseFloat(o.C);
    if (!cote || cote < 1.1) continue;

    let nom = buildAlternativeName(o, event);
    if (nom) paris.push({ nom, cote });
  }
  return paris;
}

function buildAlternativeName(o, event) {
  const G = o.G;
  const T = o.T;
  const P = o.P != null ? parseFloat(o.P) : null;

  // G=2: Totaux (Over/Under) - structure courante 1xbet
  if (G === 2) {
    if (T === 1) return `Plus de ${P ?? 2.5} buts`;
    if (T === 2) return `Moins de ${P ?? 2.5} buts`;
  }

  // G=3: Handicap asiatique
  if (G === 3 && P != null) {
    const h = P > 0 ? `+${P}` : String(P);
    return `Handicap ${event.O1} ${h}`;
  }

  // G=4: Handicap européen
  if (G === 4 && P != null) return `Handicap européen ${P > 0 ? '+' : ''}${P}`;

  // G=5: Pair/Impair
  if (G === 5) return T === 1 ? 'Total buts pair' : 'Total buts impair';

  // G=6: Corners
  if (G === 6) {
    if (T === 1) return `Plus de ${P ?? 9} corners`;
    if (T === 2) return `Moins de ${P ?? 9} corners`;
  }

  // Fallback générique
  if (P != null) return `Marché ${G} (${P})`;
  return `Marché alt. ${G}`;
}

/**
 * Génère des paris alternatifs synthétiques basés sur les cotes 1X2
 * Utilisé quand l'API ne fournit pas de marchés alternatifs (ex: virtuels).
 */
function generateSyntheticAlternatives(event) {
  const odds = extract1x2Odds(event);
  const probs = oddsToImpliedProb(odds);
  const p1 = probs.win1 || 0.33;
  const pX = probs.draw || 0.33;
  const p2 = probs.win2 || 0.33;

  // Match penalty = peu de buts, durée courte
  const paris = [];

  // Totaux buts - dérivés des probas 1X2 (match équilibré = plus de buts possibles)
  const attaque = (p1 + p2) * 0.5 + (1 - pX) * 0.3;
  const coteOver05 = attaque > 0.7 ? 1.25 : attaque > 0.5 ? 1.45 : 1.65;
  const coteUnder05 = 1 / (1 - 1 / coteOver05);
  paris.push({ nom: 'Plus de 0.5 buts', cote: Math.round(coteOver05 * 100) / 100 });
  paris.push({ nom: 'Moins de 0.5 buts', cote: Math.round(coteUnder05 * 100) / 100 });

  const coteOver15 = attaque > 0.6 ? 1.55 : attaque > 0.4 ? 1.85 : 2.2;
  const coteUnder15 = 1 / (1 - 1 / coteOver15);
  paris.push({ nom: 'Plus de 1.5 buts', cote: Math.round(coteOver15 * 100) / 100 });
  paris.push({ nom: 'Moins de 1.5 buts', cote: Math.round(coteUnder15 * 100) / 100 });

  const coteOver25 = attaque > 0.5 ? 2.1 : attaque > 0.3 ? 2.5 : 3.0;
  const coteUnder25 = 1 / (1 - 1 / coteOver25);
  paris.push({ nom: 'Plus de 2.5 buts', cote: Math.round(coteOver25 * 100) / 100 });
  paris.push({ nom: 'Moins de 2.5 buts', cote: Math.round(coteUnder25 * 100) / 100 });

  // Pair / Impair (50/50 environ)
  paris.push({ nom: 'Total buts pair', cote: 1.95 });
  paris.push({ nom: 'Total buts impair', cote: 1.9 });

  // Premier but (dérivé des probas 1X2)
  const cote1er1 = p1 > 0.4 ? 2.0 : p1 > 0.3 ? 2.3 : 2.6;
  const cote1er2 = p2 > 0.4 ? 2.0 : p2 > 0.3 ? 2.3 : 2.6;
  paris.push({ nom: `${event.O1} marque`, cote: Math.round(cote1er1 * 100) / 100 });
  paris.push({ nom: `${event.O2} marque`, cote: Math.round(cote1er2 * 100) / 100 });

  return paris;
}

/**
 * Obtient les paris alternatifs : API d'abord, sinon synthétiques
 */
function getAlternativeBets(event) {
  const fromApi = extractAlternativeMarkets(event);
  if (fromApi.length > 0) return fromApi;
  return generateSyntheticAlternatives(event);
}

/**
 * Prédit UNIQUEMENT les paris alternatifs - pas de 1X2.
 * Retourne les options prédites + la décision collective.
 */
function getAlternativePredictionsOnly(event) {
  const team1 = event.O1 || 'Équipe 1';
  const team2 = event.O2 || 'Équipe 2';
  const league = event.L || '';
  const parisAlternatifs = getAlternativeBets(event);

  if (!parisAlternatifs.length) {
    return {
      options: [],
      recommended: null,
      decision: '❌ AUCUN PARI ALTERNATIF DISPONIBLE',
      parisAlternatifs: [],
    };
  }

  const oddsData = [
    { type: '1', cote: event.E?.find((o) => o.G === 1 && o.T === 1)?.C ?? 2 },
    { type: 'X', cote: event.E?.find((o) => o.G === 1 && o.T === 2)?.C ?? 3.2 },
    { type: '2', cote: event.E?.find((o) => o.G === 1 && o.T === 3)?.C ?? 3.5 },
  ];

  const score1 = event.SC?.FS?.S1 != null ? parseInt(event.SC.FS.S1, 10) : 0;
  const score2 = event.SC?.FS?.S2 != null ? parseInt(event.SC.FS.S2, 10) : 0;
  const minute = parseMinuteFromStatus(event.SC) || 0;

  const systeme = new SystemePredictionParisAlternatifs(
    team1,
    team2,
    league,
    parisAlternatifs,
    'Football',
    score1,
    score2,
    minute
  );

  // Forcer les forces depuis les cotes 1X2
  const probs = calculerProbabilitesDepuisCotes(oddsData);
  const force1 = calculerForceEquipeDepuisCotes(oddsData, '1');
  const force2 = calculerForceEquipeDepuisCotes(oddsData, '2');
  systeme.force1 = force1;
  systeme.force2 = force2;

  const decision = systeme.genererDecisionCollectiveAlternative();

  const options = systeme.meilleuresOptions.map((opt) => {
    const pari = opt.pari ?? opt;
    return {
      nom: typeof pari === 'object' ? pari.nom : String(pari),
      cote: typeof pari === 'object' ? pari.cote : opt.cote,
      categorie: opt.categorie,
      score: opt.evaluation?.score_global ?? 0,
      confiance: opt.evaluation?.confiance ?? 0,
    };
  });

  const recommended = options[0] || null;

  return {
    options,
    recommended,
    decision,
    parisAlternatifs: parisAlternatifs.slice(0, 10),
  };
}

function parseMinuteFromStatus(sc) {
  if (!sc?.CPS) return null;
  const m = String(sc.CPS).match(/(\d+)\s*['']/);
  return m ? parseInt(m[1], 10) : null;
}

module.exports = {
  extractAlternativeMarkets,
  generateSyntheticAlternatives,
  getAlternativeBets,
  getAlternativePredictionsOnly,
};
