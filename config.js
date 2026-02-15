/**
 * Configuration des sports virtuels - FIFA & PES
 * IDs officiels depuis GetSportsShortZip (1xbet) :
 *   https://1xbet.com/service-api/LiveFeed/GetSportsShortZip?lng=fr&gr=455&withCountries=true&country=96&virtualSports=true&groupChamps=true
 * - FIFA : I=85
 * - PES  : I=144  (I=86 = Counter Strike, pas PES)
 */
module.exports = {
  api: {
    baseUrl: 'https://1xbet.com/service-api/LiveFeed/Get1x2_VZip',
    timeout: 10000,
  },
  sports: {
    fifa: {
      id: 85,
      name: 'FIFA Penalty',
      keywords: ['FIFA', 'penalty', 'pénalty', 'Penalty'],
    },
    pes: {
      id: 144,
      idFallback: 86,
      gr: 28, // Get1x2_VZip peut utiliser 86 selon l’endpoint ; on essaie les deux
      name: 'PES Penalty',
      keywords: ['PES', 'penalty', 'pénalty', 'Penalty', 'eFootball'],
    },
  },
  prediction: {
    marginOverround: 0.05,
    minOddsValue: 1.2,
    maxOddsValue: 10,
    ultimateMinOdds: 2.0,
    matchDurationMinutes: 7,
  },
};
