/**
 * Système de prédictions - Extrait de ORACXPRED/FIFA
 * Probabilités, value betting, système unifié, paris alternatifs.
 * Version Node.js
 */

// === TRADUCTIONS ET CONTEXTE ===

/**
 * Traduit le nom d'un pari alternatif et sa valeur en français.
 */
function traduirePari(nom, valeur = null) {
  const nomStr = (nom ? String(nom).toLowerCase() : '');
  const valeurStr = (valeur != null ? String(valeur) : '');
  const valeurStrLower = valeurStr.toLowerCase();
  let choix;
  if (valeurStrLower === 'yes' || valeurStrLower === 'oui') choix = 'Oui';
  else if (valeurStrLower === 'no' || valeurStrLower === 'non') choix = 'Non';
  else choix = valeurStr;

  if (nomStr.includes('total')) {
    if (nomStr.includes('over') || valeurStrLower.includes('over') || valeurStr.includes('+')) return ['Plus de buts', choix];
    if (nomStr.includes('under') || valeurStrLower.includes('under') || valeurStr.includes('-')) return ['Moins de buts', choix];
    return ['Total buts', choix];
  }
  if (nomStr.includes('both teams to score')) return ['Les deux équipes marquent', choix];
  if (nomStr.includes('handicap')) return ['Handicap', choix];
  if (nomStr.includes('pair') || nomStr.includes('impair')) return ['Pair/Impair', choix];
  return [nomStr.charAt(0).toUpperCase() + nomStr.slice(1), choix];
}

/**
 * Détecte le contexte du pari (match complet, mi-temps, etc.)
 */
function detecterContextePari(matchData) {
  const tn = (matchData?.TN || '').toLowerCase();
  const tns = (matchData?.TNS || '').toLowerCase();
  const sc = matchData?.SC || {};
  const cps = (sc?.CPS || '').toLowerCase();
  if (tns.includes('1st half') || tn.includes('première') || cps.includes('1ère')) return 'première_mi_temps';
  if (tns.includes('2nd half') || tn.includes('deuxième') || cps.includes('2ème')) return 'deuxième_mi_temps';
  if (tns.includes('half') || tn.includes('mi-temps')) return 'mi_temps';
  return 'match_complet';
}

/**
 * Calcule les probabilités depuis les cotes 1X2.
 */
function calculerProbabilitesDepuisCotes(oddsData) {
  const probabilites = {};
  if (!oddsData || !Array.isArray(oddsData)) return { '1': 33.33, 'X': 33.33, '2': 33.33 };

  const cotes = {};
  for (const odd of oddsData) {
    if (odd && typeof odd === 'object' && 'type' in odd && 'cote' in odd && ['1', '2', 'X'].includes(odd.type)) {
      try {
        cotes[odd.type] = parseFloat(odd.cote);
      } catch { continue; }
    }
  }
  if (Object.keys(cotes).length === 0) return { '1': 33.33, 'X': 33.33, '2': 33.33 };

  let totalInv = 0;
  const probabilitesBrutes = {};
  for (const [t, c] of Object.entries(cotes)) {
    if (c > 0) {
      const prob = (1 / c) * 100;
      probabilitesBrutes[t] = prob;
      totalInv += prob;
    }
  }
  if (totalInv > 0) {
    for (const [t, prob] of Object.entries(probabilitesBrutes)) {
      probabilites[t] = (prob / totalInv) * 100;
    }
  }
  return probabilites;
}

/**
 * Calcule la force d'une équipe depuis les cotes 1X2.
 */
function calculerForceEquipeDepuisCotes(oddsData, equipeType = '1') {
  const probs = calculerProbabilitesDepuisCotes(oddsData);
  const probVictoire = probs[equipeType] ?? 33.33;
  if (probVictoire >= 60) return [5, 15, 30, 35, 15];
  if (probVictoire >= 45) return [10, 25, 35, 25, 5];
  if (probVictoire >= 30) return [20, 35, 30, 15, 0];
  return [35, 40, 20, 5, 0];
}

/**
 * Estime la probabilité réelle d'un pari.
 */
function estimerProbabiliteReelle(pari, oddsData) {
  const nom = (pari?.nom || '').toLowerCase();
  const probs1x2 = calculerProbabilitesDepuisCotes(oddsData);
  if (nom.includes('plus de') && nom.includes('buts')) {
    const p1 = probs1x2['1'] ?? 33;
    const p2 = probs1x2['2'] ?? 33;
    if (p1 > 50 || p2 > 50) return 65;
    if (p1 > 40 && p2 > 40) return 70;
    return 45;
  }
  if (nom.includes('moins de') && nom.includes('buts')) {
    return 100 - estimerProbabiliteReelle({ nom: nom.replace('moins de', 'plus de') }, oddsData);
  }
  if (nom.includes('corner')) return 55;
  if (nom.includes('impair') || nom.includes('pair')) return 50;
  const cote = parseFloat(pari?.cote ?? 2.0);
  return (1 / cote) * 100;
}

/**
 * Détection d'opportunités value betting.
 */
function detecterValueBets(parisAlternatifs, oddsData) {
  const valueBets = [];
  for (const pari of parisAlternatifs || []) {
    try {
      const coteBm = parseFloat(pari?.cote ?? 0);
      if (coteBm <= 1.0) continue;
      const probBm = (1 / coteBm) * 100;
      const probReelle = estimerProbabiliteReelle(pari, oddsData);
      const valeur = (probReelle / 100 * coteBm) - 1;
      if (valeur > 0.05) {
        valueBets.push({
          pari,
          valeur: valeur * 100,
          prob_bookmaker: probBm,
          prob_reelle: probReelle,
          cote: coteBm,
          recommandation: valeur > 0.15 ? 'EXCELLENT' : valeur > 0.10 ? 'BON' : 'CORRECT'
        });
      }
    } catch { continue; }
  }
  valueBets.sort((a, b) => b.valeur - a.valeur);
  return valueBets.slice(0, 5);
}

/**
 * Critère de Kelly pour la mise optimale.
 */
function calculerMiseOptimaleKelly(bankroll, probabiliteReelle, coteBookmaker) {
  try {
    const p = probabiliteReelle / 100;
    const q = 1 - p;
    const b = coteBookmaker - 1;
    let kelly = (b * p - q) / b;
    kelly = Math.min(kelly, 0.05);
    if (kelly <= 0) return { mise_recommandee: 0, pourcentage_bankroll: 0, recommandation: 'NE PAS PARIER' };
    const mise = bankroll * kelly;
    return {
      mise_recommandee: Math.round(mise * 100) / 100,
      pourcentage_bankroll: Math.round(kelly * 10000) / 100,
      recommandation: kelly > 0.03 ? 'EXCELLENT' : kelly > 0.01 ? 'BON' : 'PRUDENT'
    };
  } catch {
    return { mise_recommandee: 0, pourcentage_bankroll: 0, recommandation: 'ERREUR' };
  }
}

/**
 * Analyse d'évolution des cotes (simulation).
 */
function analyserEvolutionCotesTempsReel(parisAlternatifs) {
  const evolution = [];
  const list = (parisAlternatifs || []).slice(0, 5);
  for (const pari of list) {
    const coteAct = parseFloat(pari?.cote ?? 2.0);
    const var_ = (Math.random() * 0.3) - 0.15;
    const cotePrec = coteAct * (1 - var_);
    const tendance = coteAct > cotePrec ? '📈 HAUSSE' : coteAct < cotePrec ? '📉 BAISSE' : '➡️ STABLE';
    evolution.push({
      pari: pari?.nom,
      cote_actuelle: coteAct,
      cote_precedente: Math.round(cotePrec * 100) / 100,
      variation: Math.round(var_ * 1000) / 10,
      tendance
    });
  }
  return evolution;
}

/**
 * Analyse le contexte temps réel du match.
 */
function analyserContexteTempsReel(score1, score2, minute) {
  const total = score1 + score2;
  if (minute === 0) return 50;
  if (minute < 30) return total >= 2 ? 75 : total === 1 ? 60 : 45;
  if (minute < 60) return total >= 3 ? 80 : total >= 2 ? 65 : 40;
  return Math.abs(score1 - score2) <= 1 ? 70 : 35;
}

/**
 * Analyse la force des équipes selon noms et ligue.
 */
function analyserForceNomsEquipes(team1, team2, league) {
  const top = ['real madrid', 'barcelona', 'psg', 'manchester city', 'liverpool', 'bayern', 'juventus'];
  const ligues = ['premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'champions league'];
  let score = 50;
  const t1 = (team1 || '').toLowerCase();
  const t2 = (team2 || '').toLowerCase();
  const lig = (league || '').toLowerCase();
  if (top.some(x => t1.includes(x))) score += 15;
  if (top.some(x => t2.includes(x))) score += 15;
  if (ligues.some(x => lig.includes(x))) score += 10;
  return Math.min(score, 90);
}

/**
 * Analyse les conditions du match.
 */
function analyserConditionsMatch(league, minute) {
  let score = 50;
  const l = (league || '').toLowerCase();
  if (l.includes('champions league')) score += 20;
  else if (['premier', 'la liga', 'serie a', 'bundesliga'].some(x => l.includes(x))) score += 15;
  if (minute >= 70 && minute <= 85) score += 10;
  else if (minute > 90) score += 15;
  return Math.min(score, 85);
}

/**
 * IA prédictive multi-facteurs.
 */
function iaPredictionMultiFacteurs(team1, team2, league, oddsData, score1 = 0, score2 = 0, minute = 0) {
  const probs = calculerProbabilitesDepuisCotes(oddsData);
  const scoreCotes = Object.keys(probs).length ? Math.max(...Object.values(probs)) : 50;
  const scoreTemps = analyserContexteTempsReel(score1, score2, minute);
  const scoreEquipes = analyserForceNomsEquipes(team1, team2, league);
  const scoreCond = analyserConditionsMatch(league, minute);
  const scoreFinal = scoreCotes * 0.40 + scoreTemps * 0.30 + scoreEquipes * 0.20 + scoreCond * 0.10;
  const conf = scoreFinal >= 75 ? 'TRÈS ÉLEVÉE' : scoreFinal >= 60 ? 'ÉLEVÉE' : scoreFinal >= 45 ? 'MODÉRÉE' : 'FAIBLE';
  const rec = scoreFinal >= 75 ? 'MISE FORTE' : scoreFinal >= 60 ? 'MISE RECOMMANDÉE' : scoreFinal >= 45 ? 'MISE PRUDENTE' : 'ÉVITER';
  return {
    score_final: Math.round(scoreFinal * 10) / 10,
    confiance_globale: Math.round(scoreFinal * 10) / 10,
    confiance: conf,
    recommandation: rec,
    bot_name: 'IA MULTI-FACTEURS',
    specialite: 'ANALYSE MULTI-FACTEURS'
  };
}

/**
 * Analyse les cotes pour une prédiction.
 */
function analyserCotes(oddsData, team1, team2) {
  if (!oddsData || !Array.isArray(oddsData)) return 'Match équilibré';
  const cotes = {};
  for (const odd of oddsData) {
    if (odd && typeof odd === 'object' && ['1', '2', 'X'].includes(odd.type)) {
      try {
        cotes[odd.type] = parseFloat(odd.cote);
      } catch { continue; }
    }
  }
  if (Object.keys(cotes).length === 0) return 'Données insuffisantes';
  const favori = Object.entries(cotes).sort((a, b) => a[1] - b[1])[0];
  const conf = Math.min(90, Math.floor(100 - (favori[1] - 1) * 30));
  if (favori[0] === '1') return `${team1} favori (confiance: ${conf}%)`;
  if (favori[0] === '2') return `${team2} favori (confiance: ${conf}%)`;
  return 'Match nul probable';
}

/**
 * Formate une prédiction pour affichage.
 */
function genererPredictionLisible(nom, valeur, team1, team2) {
  const nomL = (nom || '').toLowerCase();
  const t1 = (team1 || '').toLowerCase();
  const t2 = (team2 || '').toLowerCase();
  const eq = nomL.includes(t1) ? `🔵 ${team1}` : (nomL.includes(t2) ? `🔴 ${team2}` : '🎯 GLOBAL');
  if ((nomL.includes('total') && (nomL.includes('buts') || nomL.includes('goals')))) return `⚽ TOTAL BUTS (API): ${nom}`;
  if (nomL.includes('handicap')) return `⚖️ HANDICAP ${eq} (API): ${nom}`;
  if (nomL.includes('corner')) return `🚩 CORNERS (API): ${nom}`;
  if (nomL.includes('pair') || nomL.includes('impair')) return `🔢 ${nomL.includes('pair') ? 'PAIR' : 'IMPAIR'} (API): ${nom}`;
  if (nomL.includes('victoire')) return `🏆 VICTOIRE ${eq} (API): ${nom}`;
  return `🎲 PARI API: ${nom}`;
}

// === CLASSES ===

class SystemePredictionUnifie {
  constructor(team1, team2, league, oddsData, sport, parisAlternatifs = []) {
    this.team1 = team1;
    this.team2 = team2;
    this.league = league;
    this.oddsData = oddsData || [];
    this.sport = sport;
    this.parisAlternatifs = parisAlternatifs || [];
    this.force1 = calculerForceEquipeDepuisCotes(oddsData, '1');
    this.force2 = calculerForceEquipeDepuisCotes(oddsData, '2');
    this.analyseCotes = this._analyserCotesDetaillee();
    this.optionsPrincipales = this._identifierOptionsPrincipales();
  }

  _analyserCotesDetaillee() {
    const analyse = { cotes_1x2: {}, favori: null, confiance_favori: 0, equilibre_match: 'moyen' };
    for (const odd of this.oddsData) {
      if (odd && typeof odd === 'object' && ['1', '2', 'X'].includes(odd.type)) {
        try {
          analyse.cotes_1x2[odd.type] = parseFloat(odd.cote);
        } catch { continue; }
      }
    }
    if (Object.keys(analyse.cotes_1x2).length) {
      const favori = Object.entries(analyse.cotes_1x2).sort((a, b) => a[1] - b[1])[0];
      analyse.favori = favori[0];
      analyse.confiance_favori = Math.min(95, Math.floor(100 - (favori[1] - 1) * 25));
      const vals = Object.values(analyse.cotes_1x2);
      const ecart = Math.max(...vals) - Math.min(...vals);
      analyse.equilibre_match = ecart < 0.5 ? 'très_equilibre' : ecart < 1.0 ? 'equilibre' : ecart < 2.0 ? 'moyen' : 'desequilibre';
    }
    return analyse;
  }

  _identifierOptionsPrincipales() {
    const options = [];
    if (Object.keys(this.analyseCotes.cotes_1x2).length) {
      const cotesTriees = Object.entries(this.analyseCotes.cotes_1x2).sort((a, b) => a[1] - b[1]);
      const [f, c] = cotesTriees[0];
      const conf = Math.min(95, Math.floor((1 / c) * 100));
      if (f === '1') options.push({ type: 'resultat_1x2', prediction: `Victoire ${this.team1}`, cote: c, confiance: conf, equipe_cible: this.team1 });
      else if (f === '2') options.push({ type: 'resultat_1x2', prediction: `Victoire ${this.team2}`, cote: c, confiance: conf, equipe_cible: this.team2 });
      else options.push({ type: 'resultat_1x2', prediction: 'Match nul', cote: c, confiance: conf, equipe_cible: null });
    } else {
      options.push({ type: 'resultat_1x2', prediction: `Victoire ${this.team1}`, cote: 2.0, confiance: 50, equipe_cible: this.team1 });
    }
    const parisOk = (this.parisAlternatifs || []).filter(p => {
      const c = parseFloat(p?.cote ?? 999);
      return c >= 1.5 && c <= 3.0;
    });
    if (parisOk.length) {
      const mp = parisOk.reduce((a, b) => (parseFloat(a?.cote ?? 999) < parseFloat(b?.cote ?? 999) ? a : b));
      options.push({
        type: 'pari_alternatif',
        prediction: mp.nom,
        cote: parseFloat(mp.cote),
        confiance: Math.min(90, Math.floor((1 / parseFloat(mp.cote)) * 100)),
        equipe_cible: this._detecterEquipeCible(mp.nom),
        details: mp
      });
    }
    return options.slice(0, 2);
  }

  _detecterEquipeCible(nomPari) {
    const n = (nomPari || '').toLowerCase();
    const t1 = (this.team1 || '').toLowerCase();
    const t2 = (this.team2 || '').toLowerCase();
    if (n.includes(t1) || n.includes('o1')) return this.team1;
    if (n.includes(t2) || n.includes('o2')) return this.team2;
    return null;
  }

  genererPredictionUnifiee() {
    if (!this.optionsPrincipales.length) return 'Données insuffisantes pour une prédiction fiable';
    const donnees = this._collecterDonneesTousSystemes();
    const decision = this._deliberationCollective(donnees);
    return this._genererDecisionFinale(decision);
  }

  _collecterDonneesTousSystemes() {
    const donnees = {
      options: this.optionsPrincipales,
      systemes: { statistique: {}, cotes: {}, simulation: {}, forme: {} },
      contexte_match: {
        equilibre: this.analyseCotes.equilibre_match,
        favori: this.analyseCotes.favori,
        confiance_favori: this.analyseCotes.confiance_favori
      }
    };
    for (const opt of this.optionsPrincipales) {
      const oid = `${opt.type}_${opt.cote}`;
      donnees.systemes.statistique[oid] = this._analyseStatistique(opt);
      donnees.systemes.cotes[oid] = this._analyseCotesOption(opt);
      donnees.systemes.simulation[oid] = this._simulationMonteCarlo(opt);
      donnees.systemes.forme[oid] = this._analyseForme(opt);
    }
    return donnees;
  }

  _deliberationCollective(donnees) {
    const votes = {};
    for (const [nom, analyses] of Object.entries(donnees.systemes)) {
      let bestOpt = null;
      let bestSc = 0;
      for (const [oid, a] of Object.entries(analyses)) {
        const sc = a.probabilite * (a.confiance / 100);
        if (sc > bestSc) { bestSc = sc; bestOpt = oid; }
      }
      votes[nom] = { option_preferee: bestOpt, score: bestSc, confiance: bestOpt ? analyses[bestOpt].confiance : 0 };
    }
    return this._negociationConsensus(votes, donnees);
  }

  _negociationConsensus(votes, donnees) {
    const cnt = {};
    const sc = {};
    for (const v of Object.values(votes)) {
      const o = v.option_preferee;
      if (o) {
        cnt[o] = (cnt[o] || 0) + 1;
        sc[o] = (sc[o] || 0) + v.score;
      }
    }
    if (Object.keys(cnt).length === 0) {
      return {
        option_finale: donnees.options[0] || null,
        type_decision: 'DEFAUT',
        confiance_collective: 30,
        votes_detail: votes,
        score_final: 0
      };
    }
    const maj = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    const typ = maj[1] >= 3 ? 'CONSENSUS_FORT' : maj[1] >= 2 ? 'MAJORITE' : 'DIVISION';
    const conf = Math.min(95, (maj[1] >= 3 ? 85 : maj[1] >= 2 ? 70 : 50) + maj[1] * 5);
    const optChoisie = donnees.options.find(o => `${o.type}_${o.cote}` === maj[0]) || null;
    return {
      option_finale: optChoisie,
      type_decision: typ,
      confiance_collective: conf,
      votes_detail: votes,
      score_final: sc[maj[0]] || 0
    };
  }

  _analyseStatistique(opt) {
    let prob;
    if (opt.type === 'resultat_1x2') {
      const tf = this.force1.reduce((a, b) => a + b, 0) + this.force2.reduce((a, b) => a + b, 0);
      const p1 = tf ? (this.force1.reduce((a, b) => a + b, 0) / tf) * 100 : 33;
      const p2 = tf ? (this.force2.reduce((a, b) => a + b, 0) / tf) * 100 : 33;
      prob = opt.equipe_cible === this.team1 ? p1 : (opt.equipe_cible === this.team2 ? p2 : Math.max(15, 100 - p1 - p2));
    } else {
      prob = Math.min(85, (1 / opt.cote) * 100);
    }
    return {
      probabilite: prob,
      confiance: Math.min(90, prob * 0.9),
      recommandation: prob > 60 ? 'favorable' : prob > 40 ? 'neutre' : 'defavorable'
    };
  }

  _analyseCotesOption(opt) {
    const probImpl = (1 / opt.cote) * 100;
    const adj = this.analyseCotes.equilibre_match === 'très_equilibre' ? 0.95
      : this.analyseCotes.equilibre_match === 'equilibre' ? 1.0
        : this.analyseCotes.equilibre_match === 'desequilibre' ? 1.1 : 1.05;
    const probAdj = Math.min(95, probImpl * adj);
    return {
      probabilite: probAdj,
      confiance: Math.min(85, probAdj * 0.85),
      recommandation: opt.cote < 2.0 ? 'favorable' : opt.cote < 2.5 ? 'neutre' : 'defavorable'
    };
  }

  _simulationMonteCarlo(opt) {
    const probs = calculerProbabilitesDepuisCotes(this.oddsData);
    let prob;
    if (opt.type === 'resultat_1x2') {
      prob = opt.equipe_cible === this.team1 ? (probs['1'] ?? 33) : opt.equipe_cible === this.team2 ? (probs['2'] ?? 33) : (probs['X'] ?? 33);
    } else {
      prob = (opt.cote > 0 ? (1 / opt.cote) * 100 : 50);
    }
    return {
      probabilite: prob,
      confiance: Math.min(80, prob * 0.8),
      recommandation: prob > 55 ? 'favorable' : prob > 35 ? 'neutre' : 'defavorable'
    };
  }

  _analyseForme(opt) {
    const tf = this.force1.reduce((a, b) => a + b, 0) + this.force2.reduce((a, b) => a + b, 0);
    let fr;
    if (opt.equipe_cible === this.team1) fr = tf ? this.force1.reduce((a, b) => a + b, 0) / tf : 0.33;
    else if (opt.equipe_cible === this.team2) fr = tf ? this.force2.reduce((a, b) => a + b, 0) / tf : 0.33;
    else fr = 0.33;
    const prob = fr * 100;
    return {
      probabilite: prob,
      confiance: Math.min(75, prob * 0.75),
      recommandation: prob > 50 ? 'favorable' : prob > 30 ? 'neutre' : 'defavorable'
    };
  }

  _genererDecisionFinale(dc) {
    if (!dc.option_finale) return '❌ AUCUN CONSENSUS';
    const { option_finale: opt, type_decision: typ, confiance_collective: conf, votes_detail } = dc;
    const icon = typ === 'CONSENSUS_FORT' ? '🎯' : typ === 'MAJORITE' ? '✅' : typ === 'DIVISION' ? '⚖️' : '❓';
    const statut = typ === 'CONSENSUS_FORT' ? 'CONSENSUS UNANIME' : typ === 'MAJORITE' ? "MAJORITÉ D'ACCORD" : typ === 'DIVISION' ? 'SYSTÈMES DIVISÉS' : 'DÉFAUT';
    const action = conf >= 80 ? 'MISE RECOMMANDÉE' : conf >= 65 ? 'MISE MODÉRÉE' : conf >= 50 ? 'MISE PRUDENTE' : 'ÉVITER CE PARI';
    const eqInfo = opt.equipe_cible ? ` sur ${opt.equipe_cible}` : '';
    const votes = Object.entries(votes_detail).map(([s, v]) => v.option_preferee ? `${s.charAt(0).toUpperCase() + s.slice(1)}: ✓` : `${s.charAt(0).toUpperCase() + s.slice(1)}: ✗`);
    return `${icon} ${statut}: ${opt.prediction}${eqInfo} | Cote: ${opt.cote} | Confiance: ${conf.toFixed(1)}% | 🎯 ACTION: ${action} | 📊 Votes: [${votes.join(', ')}]`;
  }
}

class SystemePredictionParisAlternatifs {
  constructor(team1, team2, league, parisAlternatifs, sport = 'Football', score1 = 0, score2 = 0, minute = 0) {
    this.team1 = team1;
    this.team2 = team2;
    this.league = league;
    this.parisAlternatifs = parisAlternatifs || [];
    this.sport = sport;
    this.score1 = score1;
    this.score2 = score2;
    this.minute = minute;
    this.totalButsActuels = score1 + score2;
    this.force1 = [20, 35, 30, 15, 0];
    this.force2 = [20, 35, 30, 15, 0];
    this.categoriesParis = this._categoriserParisAlternatifs();
    this.meilleuresOptions = this._identifierMeilleuresOptionsAlternatives();
  }

  _categoriserParisAlternatifs() {
    const cat = { totaux: [], handicaps: [], corners: [], pair_impair: [], mi_temps: [], equipes: [], autres: [] };
    const t1 = (this.team1 || '').toLowerCase();
    const t2 = (this.team2 || '').toLowerCase();
    for (const p of this.parisAlternatifs) {
      const n = (p?.nom || '').toLowerCase();
      if (['plus de', 'moins de', 'total', 'over', 'under'].some(x => n.includes(x))) {
        if (n.includes('corner')) cat.corners.push(p);
        else cat.totaux.push(p);
      } else if (n.includes('handicap')) cat.handicaps.push(p);
      else if (['pair', 'impair', 'even', 'odd'].some(x => n.includes(x))) cat.pair_impair.push(p);
      else if (['mi-temps', 'half', '1ère', '2ème'].some(x => n.includes(x))) cat.mi_temps.push(p);
      else if ([t1, t2, 'o1', 'o2'].some(x => n.includes(x))) cat.equipes.push(p);
      else cat.autres.push(p);
    }
    return cat;
  }

  _identifierMeilleuresOptionsAlternatives() {
    const opts = [];
    for (const [cat, paris] of Object.entries(this.categoriesParis)) {
      for (const p of paris) {
        try {
          const c = parseFloat(p?.cote ?? 999);
          if (c >= 1.4 && c <= 4.0) {
            const ev = this._evaluerPariAlternatif(p, cat);
            opts.push({ pari: p, categorie: cat, evaluation: ev, cote: c });
          }
        } catch { continue; }
      }
    }
    opts.sort((a, b) => b.evaluation.score_global - a.evaluation.score_global);
    return opts.slice(0, 2);
  }

  _evaluerPariAlternatif(pari, categorie) {
    const nom = (pari?.nom || '').toLowerCase();
    const cote = parseFloat(pari?.cote ?? 999);
    const scoreCote = Math.min(100, (1 / cote) * 100);
    let bonus = 0;
    const sumForce1 = this.force1.reduce((a, b) => a + b, 0);
    const sumForce2 = this.force2.reduce((a, b) => a + b, 0);
    const force1Late = this.force1.slice(2).reduce((a, b) => a + b, 0);
    const force2Late = this.force2.slice(2).reduce((a, b) => a + b, 0);
    const force1Early = this.force1[0] + this.force1[1];
    const force2Early = this.force2[0] + this.force2[1];

    const t1L = (this.team1 || '').toLowerCase();
    const t2L = (this.team2 || '').toLowerCase();
    if (categorie === 'totaux') {
      bonus = nom.includes('plus de') ? ((force1Late + force2Late) / 2) * 0.3 : ((force1Early + force2Early) / 4) * 0.3;
    } else if (categorie === 'handicaps') bonus = Math.abs(sumForce1 - sumForce2) > 20 ? 15 : 5;
    else if (categorie === 'corners') bonus = Math.min(20, (force1Late + force2Late) * 0.2);
    else if (categorie === 'pair_impair') bonus = nom.includes('impair') ? 8 : 5;
    else if (categorie === 'equipes') {
      if (nom.includes(t1L) || nom.includes('o1')) bonus = sumForce1 > sumForce2 ? 15 : -10;
      else if (nom.includes(t2L) || nom.includes('o2')) bonus = sumForce2 > sumForce1 ? 15 : -10;
    }
    const sg = Math.min(100, Math.max(0, scoreCote + bonus));
    return { score_global: sg, confiance: Math.min(90, scoreCote * 0.8 + bonus * 0.5) };
  }

  genererDecisionCollectiveAlternative() {
    if (!this.meilleuresOptions.length) return '❌ AUCUN PARI ALTERNATIF INTÉRESSANT TROUVÉ';
    const donnees = { options: this.meilleuresOptions, systemes_specialises: { totaux: {}, handicaps: {}, corners: {}, forme: {} } };
    for (const opt of this.meilleuresOptions) {
      const oid = `${opt.categorie}_${opt.cote}`;
      donnees.systemes_specialises.totaux[oid] = this._analyseTotaux(opt);
      donnees.systemes_specialises.handicaps[oid] = this._analyseHandicaps(opt);
      donnees.systemes_specialises.corners[oid] = this._analyseCorners(opt);
      donnees.systemes_specialises.forme[oid] = this._analyseFormeAlt(opt);
    }
    const votes = {};
    for (const [nom, analyses] of Object.entries(donnees.systemes_specialises)) {
      let bestOid = null;
      let bestSc = 0;
      for (const [oid, a] of Object.entries(analyses)) {
        const sc = a.probabilite * ((a.confiance ?? 70) / 100);
        if (sc > bestSc) { bestSc = sc; bestOid = oid; }
      }
      votes[nom] = { option_preferee: bestOid, score: bestSc };
    }
    const cnt = {};
    for (const v of Object.values(votes)) {
      const o = v.option_preferee;
      if (o) cnt[o] = (cnt[o] || 0) + 1;
    }
    if (Object.keys(cnt).length === 0) return '❌ AUCUN CONSENSUS';
    const maj = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    const optChoisie = this.meilleuresOptions.find(o => `${o.categorie}_${o.cote}` === maj[0]);
    if (!optChoisie) return '❌ AUCUN CONSENSUS';
    const pari = optChoisie.pari ?? optChoisie;
    const nomPari = typeof pari === 'object' ? (pari?.nom ?? 'Pari') : String(pari);
    const cotePari = typeof pari === 'object' ? (pari?.cote ?? 2.0) : optChoisie.cote ?? 2.0;
    const typ = maj[1] >= 3 ? 'CONSENSUS FORT' : maj[1] >= 2 ? 'MAJORITÉ' : 'DIVISION';
    const conf = Math.min(90, 80 + maj[1] * 5);
    return `🎯 ${typ}: ${nomPari} | Cote: ${cotePari} | Confiance: ${conf.toFixed(1)}% | Catégorie: ${optChoisie.categorie}`;
  }

  _analyseTotaux(opt) {
    const p = opt.pari ?? opt;
    const nom = typeof p === 'object' ? (p?.nom || '').toLowerCase() : String(p).toLowerCase();
    const seuilM = nom.match(/(\d+\.?\d*)/);
    const seuil = seuilM ? parseFloat(seuilM[1]) : 2.5;
    let prob = 50;
    if (nom.includes('plus de')) {
      if (this.totalButsActuels >= seuil) prob = 95;
      else if (this.minute > 80 && (seuil - this.totalButsActuels) > 1) prob = 15;
      else prob = 60;
    } else if (nom.includes('moins de')) {
      if (this.totalButsActuels >= seuil) prob = 5;
      else if (this.minute > 80 && this.totalButsActuels < seuil - 1) prob = 90;
      else prob = 40;
    }
    return { probabilite: prob, confiance: Math.min(95, prob * 0.9) };
  }

  _analyseHandicaps(opt) {
    const p = opt.pari ?? opt;
    const nom = typeof p === 'object' ? (p?.nom || '').toLowerCase() : String(p).toLowerCase();
    const t1 = (this.team1 || '').toLowerCase();
    const t2 = (this.team2 || '').toLowerCase();
    const diff = this.force1.reduce((a, b) => a + b, 0) - this.force2.reduce((a, b) => a + b, 0);
    let prob = 50;
    if (nom.includes(t1) || nom.includes('o1')) prob = diff > 10 ? 75 : diff > 0 ? 65 : 35;
    else if (nom.includes(t2) || nom.includes('o2')) prob = diff < -10 ? 75 : diff < 0 ? 65 : 35;
    return { probabilite: prob, confiance: Math.min(80, prob * 0.8) };
  }

  _analyseCorners(opt) {
    let cb = 8;
    if (this.force1.slice(2).reduce((a, b) => a + b, 0) > 50) cb += 2;
    if (this.force2.slice(2).reduce((a, b) => a + b, 0) > 50) cb += 2;
    const prob = cb > 9 ? 70 : 50;
    return { probabilite: prob, confiance: 70 };
  }

  _analyseFormeAlt(opt) {
    const cat = opt.categorie ?? 'autre';
    let prob;
    if (cat === 'pair_impair') prob = 55;
    else if (cat === 'equipes') prob = this.force1.reduce((a, b) => a + b, 0) > this.force2.reduce((a, b) => a + b, 0) ? 60 : 40;
    else prob = 55;
    return { probabilite: prob, confiance: Math.min(70, prob * 0.7) };
  }
}

// === POINTS D'ENTRÉE ===

/**
 * Point d'entrée principal - Génère une prédiction unifiée.
 */
function genererPredictionIntelligente(team1, team2, league, oddsData, sport) {
  const systeme = new SystemePredictionUnifie(team1, team2, league, oddsData, sport);
  return systeme.genererPredictionUnifiee();
}

/**
 * Génère des prédictions alternatives avec système unifié + alternatifs.
 */
function genererPredictionsAlternatives(team1, team2, league, parisAlternatifs, oddsData, score1 = 0, score2 = 0, minute = 0) {
  if (!parisAlternatifs || !parisAlternatifs.length) return '❌ AUCUN PARI ALTERNATIF DISPONIBLE';
  const sysUni = new SystemePredictionUnifie(team1, team2, league, oddsData, 'football', parisAlternatifs);
  const sysAlt = new SystemePredictionParisAlternatifs(team1, team2, league, parisAlternatifs, 'Football', score1, score2, minute);
  const predUni = sysUni.genererPredictionUnifiee();
  const predAlt = sysAlt.genererDecisionCollectiveAlternative();
  const vrais = parisAlternatifs.slice(0, 3).map(p => `${p?.nom ?? ''} (cote: ${p?.cote ?? ''})`).join(' | ');
  return `🤖 UNIFIÉ: ${predUni} | 🎲 ALTERNATIFS: ${predAlt} | 📋 PARIS: ${vrais} | ⏱️ ${score1}-${score2} - ${minute}'`;
}

// === EXPORTS ===

module.exports = {
  traduirePari,
  detecterContextePari,
  calculerProbabilitesDepuisCotes,
  calculerForceEquipeDepuisCotes,
  estimerProbabiliteReelle,
  detecterValueBets,
  calculerMiseOptimaleKelly,
  analyserEvolutionCotesTempsReel,
  analyserContexteTempsReel,
  analyserForceNomsEquipes,
  analyserConditionsMatch,
  iaPredictionMultiFacteurs,
  analyserCotes,
  genererPredictionLisible,
  SystemePredictionUnifie,
  SystemePredictionParisAlternatifs,
  genererPredictionIntelligente,
  genererPredictionsAlternatives
};
