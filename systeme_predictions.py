# -*- coding: utf-8 -*-
"""
Système de prédictions - Extrait de ORACXPRED/FIFA
Probabilités, value betting, système unifié, paris alternatifs.
"""
import random
import re

# === TRADUCTIONS ET CONTEXTE ===
def traduire_pari(nom, valeur=None):
    """Traduit le nom d'un pari alternatif et sa valeur en français."""
    nom_str = str(nom).lower() if nom else ""
    valeur_str = str(valeur) if valeur is not None else ""
    valeur_str_lower = valeur_str.lower()
    if valeur_str_lower in ["yes", "oui"]:
        choix = "Oui"
    elif valeur_str_lower in ["no", "non"]:
        choix = "Non"
    else:
        choix = valeur_str
    if "total" in nom_str:
        if "over" in nom_str or "over" in valeur_str_lower or "+" in valeur_str:
            return ("Plus de buts", choix)
        elif "under" in nom_str or "under" in valeur_str_lower or "-" in valeur_str:
            return ("Moins de buts", choix)
        return ("Total buts", choix)
    elif "both teams to score" in nom_str:
        return ("Les deux équipes marquent", choix)
    elif "handicap" in nom_str:
        return ("Handicap", choix)
    elif "pair" in nom_str or "impair" in nom_str:
        return ("Pair/Impair", choix)
    return (nom_str.capitalize(), choix)

def detecter_contexte_pari(match_data):
    """Détecte le contexte du pari (match complet, mi-temps, etc.)"""
    tn = match_data.get("TN", "").lower()
    tns = match_data.get("TNS", "").lower()
    sc = match_data.get("SC", {})
    cps = sc.get("CPS", "").lower()
    if "1st half" in tns or "première" in tn or "1ère" in cps:
        return "première_mi_temps"
    elif "2nd half" in tns or "deuxième" in tn or "2ème" in cps:
        return "deuxième_mi_temps"
    elif "half" in tns or "mi-temps" in tn:
        return "mi_temps"
    return "match_complet"

def calculer_probabilites_depuis_cotes(odds_data):
    """Calcule les probabilités depuis les cotes 1X2."""
    probabilites = {}
    if not odds_data:
        return {"1": 33.33, "X": 33.33, "2": 33.33}
    cotes = {}
    for odd in odds_data:
        if isinstance(odd, dict) and 'type' in odd and 'cote' in odd:
            if odd['type'] in ['1', '2', 'X']:
                try:
                    cotes[odd['type']] = float(odd['cote'])
                except (ValueError, TypeError):
                    continue
    if not cotes:
        return {"1": 33.33, "X": 33.33, "2": 33.33}
    total_inv = 0
    probabilites_brutes = {}
    for t, c in cotes.items():
        if c > 0:
            prob = (1 / c) * 100
            probabilites_brutes[t] = prob
            total_inv += prob
    if total_inv > 0:
        for t, prob in probabilites_brutes.items():
            probabilites[t] = (prob / total_inv) * 100
    return probabilites

def calculer_force_equipe_depuis_cotes(odds_data, equipe_type="1"):
    """Calcule la force d'une équipe depuis les cotes 1X2."""
    probs = calculer_probabilites_depuis_cotes(odds_data)
    prob_victoire = probs.get(equipe_type, 33.33)
    if prob_victoire >= 60:
        return [5, 15, 30, 35, 15]
    elif prob_victoire >= 45:
        return [10, 25, 35, 25, 5]
    elif prob_victoire >= 30:
        return [20, 35, 30, 15, 0]
    return [35, 40, 20, 5, 0]

def estimer_probabilite_reelle(pari, odds_data):
    """Estime la probabilité réelle d'un pari."""
    nom = pari.get('nom', '').lower()
    probs_1x2 = calculer_probabilites_depuis_cotes(odds_data)
    if 'plus de' in nom and 'buts' in nom:
        p1, p2 = probs_1x2.get('1', 33), probs_1x2.get('2', 33)
        if p1 > 50 or p2 > 50:
            return 65
        if p1 > 40 and p2 > 40:
            return 70
        return 45
    elif 'moins de' in nom and 'buts' in nom:
        return 100 - estimer_probabilite_reelle({'nom': nom.replace('moins de', 'plus de')}, odds_data)
    elif 'corner' in nom:
        return 55
    elif 'impair' in nom or 'pair' in nom:
        return 50
    cote = float(pari.get('cote', 2.0))
    return (1 / cote) * 100

def detecter_value_bets(paris_alternatifs, odds_data):
    """Détection d'opportunités value betting."""
    value_bets = []
    for pari in paris_alternatifs or []:
        try:
            cote_bm = float(pari.get('cote', 0))
            if cote_bm <= 1.0:
                continue
            prob_bm = (1 / cote_bm) * 100
            prob_reelle = estimer_probabilite_reelle(pari, odds_data)
            valeur = (prob_reelle / 100 * cote_bm) - 1
            if valeur > 0.05:
                value_bets.append({
                    'pari': pari, 'valeur': valeur * 100, 'prob_bookmaker': prob_bm,
                    'prob_reelle': prob_reelle, 'cote': cote_bm,
                    'recommandation': 'EXCELLENT' if valeur > 0.15 else 'BON' if valeur > 0.10 else 'CORRECT'
                })
        except (ValueError, TypeError):
            continue
    value_bets.sort(key=lambda x: x['valeur'], reverse=True)
    return value_bets[:5]

def calculer_mise_optimale_kelly(bankroll, probabilite_reelle, cote_bookmaker):
    """Critère de Kelly pour la mise optimale."""
    try:
        p, q = probabilite_reelle / 100, 1 - probabilite_reelle / 100
        b = cote_bookmaker - 1
        kelly = (b * p - q) / b
        kelly = min(kelly, 0.05)
        if kelly <= 0:
            return {'mise_recommandee': 0, 'pourcentage_bankroll': 0, 'recommandation': 'NE PAS PARIER'}
        mise = bankroll * kelly
        return {
            'mise_recommandee': round(mise, 2), 'pourcentage_bankroll': round(kelly * 100, 2),
            'recommandation': 'EXCELLENT' if kelly > 0.03 else 'BON' if kelly > 0.01 else 'PRUDENT'
        }
    except:
        return {'mise_recommandee': 0, 'pourcentage_bankroll': 0, 'recommandation': 'ERREUR'}

def analyser_evolution_cotes_temps_reel(paris_alternatifs):
    """Analyse d'évolution des cotes (simulation)."""
    evolution = []
    for pari in (paris_alternatifs or [])[:5]:
        cote_act = float(pari.get('cote', 2.0))
        var = random.uniform(-0.15, 0.15)
        cote_prec = cote_act * (1 - var)
        tendance = "📈 HAUSSE" if cote_act > cote_prec else "📉 BAISSE" if cote_act < cote_prec else "➡️ STABLE"
        evolution.append({'pari': pari['nom'], 'cote_actuelle': cote_act, 'cote_precedente': round(cote_prec, 2),
                         'variation': round(var * 100, 1), 'tendance': tendance})
    return evolution

def analyser_contexte_temps_reel(score1, score2, minute):
    """Analyse le contexte temps réel du match."""
    total = score1 + score2
    if minute == 0:
        return 50
    elif minute < 30:
        return 75 if total >= 2 else 60 if total == 1 else 45
    elif minute < 60:
        return 80 if total >= 3 else 65 if total >= 2 else 40
    return 70 if abs(score1 - score2) <= 1 else 35

def analyser_force_noms_equipes(team1, team2, league):
    """Analyse la force des équipes selon noms et ligue."""
    top = ["real madrid", "barcelona", "psg", "manchester city", "liverpool", "bayern", "juventus"]
    ligues = ["premier league", "la liga", "serie a", "bundesliga", "ligue 1", "champions league"]
    score = 50
    t1, t2, lig = team1.lower(), team2.lower(), league.lower()
    if any(x in t1 for x in top): score += 15
    if any(x in t2 for x in top): score += 15
    if any(x in lig for x in ligues): score += 10
    return min(score, 90)

def analyser_conditions_match(league, minute):
    """Analyse les conditions du match."""
    score = 50
    if "champions league" in league.lower():
        score += 20
    elif any(x in league.lower() for x in ["premier", "la liga", "serie a", "bundesliga"]):
        score += 15
    if 70 <= minute <= 85:
        score += 10
    elif minute > 90:
        score += 15
    return min(score, 85)

def ia_prediction_multi_facteurs(team1, team2, league, odds_data, score1=0, score2=0, minute=0):
    """IA prédictive multi-facteurs."""
    probs = calculer_probabilites_depuis_cotes(odds_data)
    score_cotes = max(probs.values()) if probs else 50
    score_temps = analyser_contexte_temps_reel(score1, score2, minute)
    score_equipes = analyser_force_noms_equipes(team1, team2, league)
    score_cond = analyser_conditions_match(league, minute)
    score_final = score_cotes * 0.40 + score_temps * 0.30 + score_equipes * 0.20 + score_cond * 0.10
    conf = "TRÈS ÉLEVÉE" if score_final >= 75 else "ÉLEVÉE" if score_final >= 60 else "MODÉRÉE" if score_final >= 45 else "FAIBLE"
    rec = "MISE FORTE" if score_final >= 75 else "MISE RECOMMANDÉE" if score_final >= 60 else "MISE PRUDENTE" if score_final >= 45 else "ÉVITER"
    return {'score_final': round(score_final, 1), 'confiance_globale': round(score_final, 1), 'confiance': conf,
            'recommandation': rec, 'bot_name': 'IA MULTI-FACTEURS', 'specialite': 'ANALYSE MULTI-FACTEURS'}

def analyser_cotes(odds_data, team1, team2):
    """Analyse les cotes pour une prédiction."""
    if not odds_data:
        return "Match équilibré"
    cotes = {}
    for odd in odds_data:
        if isinstance(odd, dict) and odd.get('type') in ['1', '2', 'X']:
            try:
                cotes[odd['type']] = float(odd['cote'])
            except (ValueError, TypeError):
                continue
    if not cotes:
        return "Données insuffisantes"
    favori = min(cotes.items(), key=lambda x: x[1])
    conf = min(90, int(100 - (favori[1] - 1) * 30))
    if favori[0] == '1':
        return f"{team1} favori (confiance: {conf}%)"
    elif favori[0] == '2':
        return f"{team2} favori (confiance: {conf}%)"
    return "Match nul probable"

def generer_prediction_lisible(nom, valeur, team1, team2):
    """Formate une prédiction pour affichage."""
    nom_l = nom.lower()
    eq = f"🔵 {team1}" if team1.lower() in nom_l else (f"🔴 {team2}" if team2.lower() in nom_l else "🎯 GLOBAL")
    if ("total" in nom_l and ("buts" in nom_l or "goals" in nom_l)):
        return f"⚽ TOTAL BUTS (API): {nom}"
    elif "handicap" in nom_l:
        return f"⚖️ HANDICAP {eq} (API): {nom}"
    elif "corner" in nom_l:
        return f"🚩 CORNERS (API): {nom}"
    elif "pair" in nom_l or "impair" in nom_l:
        return f"🔢 {'PAIR' if 'pair' in nom_l else 'IMPAIR'} (API): {nom}"
    elif "victoire" in nom_l:
        return f"🏆 VICTOIRE {eq} (API): {nom}"
    return f"🎲 PARI API: {nom}"


class SystemePredictionUnifie:
    """Système de prédiction unifié 1X2 + alternatifs"""

    def __init__(self, team1, team2, league, odds_data, sport, paris_alternatifs=None):
        self.team1 = team1
        self.team2 = team2
        self.league = league
        self.odds_data = odds_data or []
        self.sport = sport
        self.paris_alternatifs = paris_alternatifs or []
        self.force1 = calculer_force_equipe_depuis_cotes(odds_data, "1")
        self.force2 = calculer_force_equipe_depuis_cotes(odds_data, "2")
        self.analyse_cotes = self._analyser_cotes_detaillee()
        self.options_principales = self._identifier_options_principales()

    def _analyser_cotes_detaillee(self):
        analyse = {'cotes_1x2': {}, 'favori': None, 'confiance_favori': 0, 'equilibre_match': 'moyen'}
        for odd in self.odds_data:
            if isinstance(odd, dict) and odd.get('type') in ['1', '2', 'X']:
                try:
                    analyse['cotes_1x2'][odd['type']] = float(odd['cote'])
                except (ValueError, TypeError):
                    continue
        if analyse['cotes_1x2']:
            favori = min(analyse['cotes_1x2'].items(), key=lambda x: x[1])
            analyse['favori'] = favori[0]
            analyse['confiance_favori'] = min(95, int(100 - (favori[1] - 1) * 25))
            vals = list(analyse['cotes_1x2'].values())
            ecart = max(vals) - min(vals)
            analyse['equilibre_match'] = 'très_equilibre' if ecart < 0.5 else 'equilibre' if ecart < 1.0 else 'moyen' if ecart < 2.0 else 'desequilibre'
        return analyse

    def _identifier_options_principales(self):
        options = []
        if self.analyse_cotes['cotes_1x2']:
            cotes_triees = sorted(self.analyse_cotes['cotes_1x2'].items(), key=lambda x: x[1])
            f, c = cotes_triees[0][0], cotes_triees[0][1]
            conf = min(95, int((1 / c) * 100))
            if f == '1':
                options.append({'type': 'resultat_1x2', 'prediction': f"Victoire {self.team1}", 'cote': c, 'confiance': conf, 'equipe_cible': self.team1})
            elif f == '2':
                options.append({'type': 'resultat_1x2', 'prediction': f"Victoire {self.team2}", 'cote': c, 'confiance': conf, 'equipe_cible': self.team2})
            else:
                options.append({'type': 'resultat_1x2', 'prediction': "Match nul", 'cote': c, 'confiance': conf, 'equipe_cible': None})
        else:
            options.append({'type': 'resultat_1x2', 'prediction': f"Victoire {self.team1}", 'cote': 2.0, 'confiance': 50, 'equipe_cible': self.team1})
        paris_ok = [p for p in self.paris_alternatifs if 1.5 <= float(p.get("cote", 999)) <= 3.0]
        if paris_ok:
            mp = min(paris_ok, key=lambda x: float(x["cote"]))
            options.append({'type': 'pari_alternatif', 'prediction': mp['nom'], 'cote': float(mp['cote']),
                           'confiance': min(90, int((1 / float(mp['cote'])) * 100)), 'equipe_cible': self._detecter_equipe_cible(mp['nom']), 'details': mp})
        return options[:2]

    def _detecter_equipe_cible(self, nom_pari):
        n = nom_pari.lower()
        if self.team1.lower() in n or "o1" in n: return self.team1
        if self.team2.lower() in n or "o2" in n: return self.team2
        return None

    def generer_prediction_unifiee(self):
        if not self.options_principales:
            return "Données insuffisantes pour une prédiction fiable"
        donnees = self._collecter_donnees_tous_systemes()
        decision = self._deliberation_collective(donnees)
        return self._generer_decision_finale(decision)

    def _collecter_donnees_tous_systemes(self):
        donnees = {'options': self.options_principales, 'systemes': {'statistique': {}, 'cotes': {}, 'simulation': {}, 'forme': {}},
                   'contexte_match': {'equilibre': self.analyse_cotes['equilibre_match'], 'favori': self.analyse_cotes['favori'], 'confiance_favori': self.analyse_cotes['confiance_favori']}}
        for opt in self.options_principales:
            oid = opt['type'] + '_' + str(opt['cote'])
            donnees['systemes']['statistique'][oid] = self._analyse_statistique(opt)
            donnees['systemes']['cotes'][oid] = self._analyse_cotes_option(opt)
            donnees['systemes']['simulation'][oid] = self._simulation_monte_carlo(opt)
            donnees['systemes']['forme'][oid] = self._analyse_forme(opt)
        return donnees

    def _deliberation_collective(self, donnees):
        votes = {}
        for nom, analyses in donnees['systemes'].items():
            best_opt, best_sc = None, 0
            for oid, a in analyses.items():
                sc = a['probabilite'] * (a['confiance'] / 100)
                if sc > best_sc:
                    best_sc, best_opt = sc, oid
            votes[nom] = {'option_preferee': best_opt, 'score': best_sc, 'confiance': analyses[best_opt]['confiance'] if best_opt else 0}
        return self._negociation_consensus(votes, donnees)

    def _negociation_consensus(self, votes, donnees):
        cnt, sc = {}, {}
        for v in votes.values():
            o = v['option_preferee']
            if o:
                cnt[o] = cnt.get(o, 0) + 1
                sc[o] = sc.get(o, 0) + v['score']
        if not cnt:
            return {'option_finale': donnees['options'][0] if donnees['options'] else None, 'type_decision': "DEFAUT", 'confiance_collective': 30, 'votes_detail': votes, 'score_final': 0}
        maj = max(cnt.items(), key=lambda x: x[1])
        typ = "CONSENSUS_FORT" if maj[1] >= 3 else "MAJORITE" if maj[1] >= 2 else "DIVISION"
        conf = min(95, (85 if maj[1] >= 3 else 70 if maj[1] >= 2 else 50) + maj[1] * 5)
        opt_choisie = next((o for o in donnees['options'] if o['type'] + '_' + str(o['cote']) == maj[0]), None)
        return {'option_finale': opt_choisie, 'type_decision': typ, 'confiance_collective': conf, 'votes_detail': votes, 'score_final': sc.get(maj[0], 0)}

    def _analyse_statistique(self, opt):
        if opt['type'] == 'resultat_1x2':
            tf = sum(self.force1) + sum(self.force2)
            p1 = (sum(self.force1) / tf) * 100 if tf else 33
            p2 = (sum(self.force2) / tf) * 100 if tf else 33
            prob = p1 if opt['equipe_cible'] == self.team1 else (p2 if opt['equipe_cible'] == self.team2 else max(15, 100 - p1 - p2))
        else:
            prob = min(85, (1 / opt['cote']) * 100)
        return {'probabilite': prob, 'confiance': min(90, prob * 0.9), 'recommandation': 'favorable' if prob > 60 else 'neutre' if prob > 40 else 'defavorable'}

    def _analyse_cotes_option(self, opt):
        prob_impl = (1 / opt['cote']) * 100
        adj = 0.95 if self.analyse_cotes['equilibre_match'] == 'très_equilibre' else 1.0 if self.analyse_cotes['equilibre_match'] == 'equilibre' else 1.1 if self.analyse_cotes['equilibre_match'] == 'desequilibre' else 1.05
        prob_adj = min(95, prob_impl * adj)
        return {'probabilite': prob_adj, 'confiance': min(85, prob_adj * 0.85), 'recommandation': 'favorable' if opt['cote'] < 2.0 else 'neutre' if opt['cote'] < 2.5 else 'defavorable'}

    def _simulation_monte_carlo(self, opt):
        probs = calculer_probabilites_depuis_cotes(self.odds_data)
        if opt['type'] == 'resultat_1x2':
            prob = probs.get('1', 33) if opt['equipe_cible'] == self.team1 else (probs.get('2', 33) if opt['equipe_cible'] == self.team2 else probs.get('X', 33))
        else:
            prob = (1 / opt['cote']) * 100 if opt.get('cote', 0) > 0 else 50
        return {'probabilite': prob, 'confiance': min(80, prob * 0.8), 'recommandation': 'favorable' if prob > 55 else 'neutre' if prob > 35 else 'defavorable'}

    def _analyse_forme(self, opt):
        tf = sum(self.force1) + sum(self.force2)
        if opt['equipe_cible'] == self.team1:
            fr = sum(self.force1) / tf if tf else 0.33
        elif opt['equipe_cible'] == self.team2:
            fr = sum(self.force2) / tf if tf else 0.33
        else:
            fr = 0.33
        prob = fr * 100
        return {'probabilite': prob, 'confiance': min(75, prob * 0.75), 'recommandation': 'favorable' if prob > 50 else 'neutre' if prob > 30 else 'defavorable'}

    def _generer_decision_finale(self, dc):
        if not dc['option_finale']:
            return "❌ AUCUN CONSENSUS"
        opt, typ, conf = dc['option_finale'], dc['type_decision'], dc['confiance_collective']
        icon = "🎯" if typ == "CONSENSUS_FORT" else "✅" if typ == "MAJORITE" else "⚖️" if typ == "DIVISION" else "❓"
        statut = "CONSENSUS UNANIME" if typ == "CONSENSUS_FORT" else "MAJORITÉ D'ACCORD" if typ == "MAJORITE" else "SYSTÈMES DIVISÉS" if typ == "DIVISION" else "DÉFAUT"
        action = "MISE RECOMMANDÉE" if conf >= 80 else "MISE MODÉRÉE" if conf >= 65 else "MISE PRUDENTE" if conf >= 50 else "ÉVITER CE PARI"
        eq_info = f" sur {opt['equipe_cible']}" if opt.get('equipe_cible') else ""
        votes = [f"{s.title()}: ✓" if v['option_preferee'] else f"{s.title()}: ✗" for s, v in dc['votes_detail'].items()]
        return f"{icon} {statut}: {opt['prediction']}{eq_info} | Cote: {opt['cote']} | Confiance: {conf:.1f}% | 🎯 ACTION: {action} | 📊 Votes: [{', '.join(votes)}]"


class SystemePredictionParisAlternatifs:
    """Système de prédiction spécialisé pour les paris alternatifs (totaux, handicaps, corners...)."""

    def __init__(self, team1, team2, league, paris_alternatifs, sport="Football", score1=0, score2=0, minute=0):
        self.team1, self.team2, self.league = team1, team2, league
        self.paris_alternatifs = paris_alternatifs or []
        self.sport = sport
        self.score1, self.score2, self.minute = score1, score2, minute
        self.total_buts_actuels = score1 + score2
        self.force1 = [20, 35, 30, 15, 0]
        self.force2 = [20, 35, 30, 15, 0]
        self.categories_paris = self._categoriser_paris_alternatifs()
        self.meilleures_options = self._identifier_meilleures_options_alternatives()

    def _categoriser_paris_alternatifs(self):
        cat = {'totaux': [], 'handicaps': [], 'corners': [], 'pair_impair': [], 'mi_temps': [], 'equipes': [], 'autres': []}
        for p in self.paris_alternatifs:
            n = p.get('nom', '').lower()
            if any(x in n for x in ['plus de', 'moins de', 'total', 'over', 'under']):
                (cat['corners'] if 'corner' in n else cat['totaux']).append(p)
            elif 'handicap' in n: cat['handicaps'].append(p)
            elif any(x in n for x in ['pair', 'impair', 'even', 'odd']): cat['pair_impair'].append(p)
            elif any(x in n for x in ['mi-temps', 'half', '1ère', '2ème']): cat['mi_temps'].append(p)
            elif any(x in n for x in [self.team1.lower(), self.team2.lower(), 'o1', 'o2']): cat['equipes'].append(p)
            else: cat['autres'].append(p)
        return cat

    def _identifier_meilleures_options_alternatives(self):
        opts = []
        for cat, paris in self.categories_paris.items():
            for p in paris:
                try:
                    c = float(p.get('cote', 999))
                    if 1.4 <= c <= 4.0:
                        ev = self._evaluer_pari_alternatif(p, cat)
                        opts.append({'pari': p, 'categorie': cat, 'evaluation': ev, 'cote': c})
                except (ValueError, TypeError):
                    continue
        opts.sort(key=lambda x: x['evaluation']['score_global'], reverse=True)
        return opts[:2]

    def _evaluer_pari_alternatif(self, pari, categorie):
        nom, cote = pari.get('nom', '').lower(), float(pari.get('cote', 999))
        score_cote = min(100, (1 / cote) * 100)
        bonus = 0
        if categorie == 'totaux':
            bonus = (sum(self.force1[2:]) + sum(self.force2[2:])) / 2 * 0.3 if 'plus de' in nom else (self.force1[0]+self.force1[1]+self.force2[0]+self.force2[1])/4*0.3
        elif categorie == 'handicaps': bonus = 15 if abs(sum(self.force1)-sum(self.force2)) > 20 else 5
        elif categorie == 'corners': bonus = min(20, (sum(self.force1[2:])+sum(self.force2[2:]))*0.2)
        elif categorie == 'pair_impair': bonus = 8 if 'impair' in nom else 5
        elif categorie == 'equipes':
            if any(x in nom for x in [self.team1.lower(), 'o1']): bonus = 15 if sum(self.force1) > sum(self.force2) else -10
            elif any(x in nom for x in [self.team2.lower(), 'o2']): bonus = 15 if sum(self.force2) > sum(self.force1) else -10
        sg = min(100, max(0, score_cote + bonus))
        return {'score_global': sg, 'confiance': min(90, score_cote*0.8 + bonus*0.5)}

    def generer_decision_collective_alternative(self):
        if not self.meilleures_options:
            return "❌ AUCUN PARI ALTERNATIF INTÉRESSANT TROUVÉ"
        donnees = {'options': self.meilleures_options, 'systemes_specialises': {'totaux': {}, 'handicaps': {}, 'corners': {}, 'forme': {}}}
        for opt in self.meilleures_options:
            oid = f"{opt['categorie']}_{opt['cote']}"
            donnees['systemes_specialises']['totaux'][oid] = self._analyse_totaux(opt)
            donnees['systemes_specialises']['handicaps'][oid] = self._analyse_handicaps(opt)
            donnees['systemes_specialises']['corners'][oid] = self._analyse_corners(opt)
            donnees['systemes_specialises']['forme'][oid] = self._analyse_forme_alt(opt)
        votes = {}
        for nom, analyses in donnees['systemes_specialises'].items():
            best_oid, best_sc = None, 0
            for oid, a in analyses.items():
                sc = a['probabilite'] * (a.get('confiance', 70) / 100)
                if sc > best_sc: best_sc, best_oid = sc, oid
            votes[nom] = {'option_preferee': best_oid, 'score': best_sc}
        cnt = {}
        for v in votes.values():
            o = v['option_preferee']
            if o: cnt[o] = cnt.get(o, 0) + 1
        if not cnt:
            return "❌ AUCUN CONSENSUS"
        maj = max(cnt.items(), key=lambda x: x[1])
        opt_choisie = next((o for o in self.meilleures_options if f"{o['categorie']}_{o['cote']}" == maj[0]), None)
        if not opt_choisie:
            return "❌ AUCUN CONSENSUS"
        pari = opt_choisie.get('pari', opt_choisie)
        nom_pari = pari.get('nom', 'Pari') if isinstance(pari, dict) else str(pari)
        cote_pari = pari.get('cote', 2.0) if isinstance(pari, dict) else opt_choisie.get('cote', 2.0)
        typ = "CONSENSUS FORT" if maj[1] >= 3 else "MAJORITÉ" if maj[1] >= 2 else "DIVISION"
        conf = min(90, 80 + maj[1]*5)
        return f"🎯 {typ}: {nom_pari} | Cote: {cote_pari} | Confiance: {conf:.1f}% | Catégorie: {opt_choisie['categorie']}"

    def _analyse_totaux(self, opt):
        p = opt.get('pari', opt)
        nom = p.get('nom', '').lower() if isinstance(p, dict) else str(p).lower()
        seuil_m = re.search(r'(\d+\.?\d*)', nom)
        seuil = float(seuil_m.group(1)) if seuil_m else 2.5
        prob = 50
        if 'plus de' in nom:
            if self.total_buts_actuels >= seuil: prob = 95
            elif self.minute > 80 and (seuil - self.total_buts_actuels) > 1: prob = 15
            else: prob = 60
        elif 'moins de' in nom:
            if self.total_buts_actuels >= seuil: prob = 5
            elif self.minute > 80 and self.total_buts_actuels < seuil - 1: prob = 90
            else: prob = 40
        return {'probabilite': prob, 'confiance': min(95, prob*0.9)}

    def _analyse_handicaps(self, opt):
        p = opt.get('pari', opt)
        nom = p.get('nom', '').lower() if isinstance(p, dict) else str(p).lower()
        diff = sum(self.force1) - sum(self.force2)
        prob = 50
        if any(x in nom for x in [self.team1.lower(), 'o1']):
            prob = 75 if diff > 10 else 65 if diff > 0 else 35
        elif any(x in nom for x in [self.team2.lower(), 'o2']):
            prob = 75 if diff < -10 else 65 if diff < 0 else 35
        return {'probabilite': prob, 'confiance': min(80, prob*0.8)}

    def _analyse_corners(self, opt):
        cb = 8
        if sum(self.force1[2:]) > 50: cb += 2
        if sum(self.force2[2:]) > 50: cb += 2
        prob = 70 if cb > 9 else 50
        return {'probabilite': prob, 'confiance': 70}

    def _analyse_forme_alt(self, opt):
        cat = opt.get('categorie', 'autre')
        if cat == 'pair_impair': prob = 55
        elif cat == 'equipes': prob = 60 if sum(self.force1) > sum(self.force2) else 40
        else: prob = 55
        return {'probabilite': prob, 'confiance': min(70, prob*0.7)}


def generer_prediction_intelligente(team1, team2, league, odds_data, sport):
    """Point d'entrée principal - Génère une prédiction unifiée."""
    systeme = SystemePredictionUnifie(team1, team2, league, odds_data, sport)
    return systeme.generer_prediction_unifiee()


def generer_predictions_alternatives(team1, team2, league, paris_alternatifs, odds_data, score1=0, score2=0, minute=0):
    """Génère des prédictions alternatives avec système unifié + alternatifs."""
    if not paris_alternatifs:
        return "❌ AUCUN PARI ALTERNATIF DISPONIBLE"
    sys_uni = SystemePredictionUnifie(team1, team2, league, odds_data, "football", paris_alternatifs)
    sys_alt = SystemePredictionParisAlternatifs(team1, team2, league, paris_alternatifs, "Football", score1, score2, minute)
    pred_uni = sys_uni.generer_prediction_unifiee()
    pred_alt = sys_alt.generer_decision_collective_alternative()
    vrais = " | ".join([f"{p.get('nom','')} (cote: {p.get('cote','')})" for p in paris_alternatifs[:3]])
    return f"🤖 UNIFIÉ: {pred_uni} | 🎲 ALTERNATIFS: {pred_alt} | 📋 PARIS: {vrais} | ⏱️ {score1}-{score2} - {minute}'"
