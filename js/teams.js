// All 32 NFL teams, keyed by ESPN's abbreviation.
export const TEAMS = {
  ARI: { city: 'Arizona', name: 'Cardinals' },
  ATL: { city: 'Atlanta', name: 'Falcons' },
  BAL: { city: 'Baltimore', name: 'Ravens' },
  BUF: { city: 'Buffalo', name: 'Bills' },
  CAR: { city: 'Carolina', name: 'Panthers' },
  CHI: { city: 'Chicago', name: 'Bears' },
  CIN: { city: 'Cincinnati', name: 'Bengals' },
  CLE: { city: 'Cleveland', name: 'Browns' },
  DAL: { city: 'Dallas', name: 'Cowboys' },
  DEN: { city: 'Denver', name: 'Broncos' },
  DET: { city: 'Detroit', name: 'Lions' },
  GB: { city: 'Green Bay', name: 'Packers' },
  HOU: { city: 'Houston', name: 'Texans' },
  IND: { city: 'Indianapolis', name: 'Colts' },
  JAX: { city: 'Jacksonville', name: 'Jaguars' },
  KC: { city: 'Kansas City', name: 'Chiefs' },
  LV: { city: 'Las Vegas', name: 'Raiders' },
  LAC: { city: 'Los Angeles', name: 'Chargers' },
  LAR: { city: 'Los Angeles', name: 'Rams' },
  MIA: { city: 'Miami', name: 'Dolphins' },
  MIN: { city: 'Minnesota', name: 'Vikings' },
  NE: { city: 'New England', name: 'Patriots' },
  NO: { city: 'New Orleans', name: 'Saints' },
  NYG: { city: 'New York', name: 'Giants' },
  NYJ: { city: 'New York', name: 'Jets' },
  PHI: { city: 'Philadelphia', name: 'Eagles' },
  PIT: { city: 'Pittsburgh', name: 'Steelers' },
  SF: { city: 'San Francisco', name: '49ers' },
  SEA: { city: 'Seattle', name: 'Seahawks' },
  TB: { city: 'Tampa Bay', name: 'Buccaneers' },
  TEN: { city: 'Tennessee', name: 'Titans' },
  WSH: { city: 'Washington', name: 'Commanders' },
};

// Other spellings ESPN (or people) sometimes use for the same team.
const ABBR_ALIASES = { WAS: 'WSH', LA: 'LAR', JAC: 'JAX', GNB: 'GB', KAN: 'KC', NWE: 'NE', NOR: 'NO', SFO: 'SF', TAM: 'TB', LVR: 'LV' };

export function normalizeAbbr(abbr) {
  const a = String(abbr || '').toUpperCase();
  return ABBR_ALIASES[a] || a;
}

const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Build a lookup of every name a person might type for a team.
const LOOKUP = {};
const cityCount = {};
for (const t of Object.values(TEAMS)) cityCount[key(t.city)] = (cityCount[key(t.city)] || 0) + 1;
for (const [abbr, t] of Object.entries(TEAMS)) {
  const names = [abbr, t.name, `${t.city} ${t.name}`];
  if (cityCount[key(t.city)] === 1) names.push(t.city); // "Los Angeles" / "New York" are ambiguous
  for (const n of names) LOOKUP[key(n)] = abbr;
}
for (const [abbr, t] of Object.entries(ABBR_ALIASES)) LOOKUP[key(abbr)] = t;
Object.assign(LOOKUP, {
  niners: 'SF', sanfrancisco49ers: 'SF', bucs: 'TB', tampa: 'TB', pats: 'NE', jags: 'JAX',
  vegas: 'LV', larams: 'LAR', lachargers: 'LAC', nygiants: 'NYG', nyjets: 'NYJ', football: 'WSH',
});

/** Turn whatever someone typed ("Vikings", "Minnesota", "MIN") into an abbreviation, or null. */
export function findTeam(text) {
  return LOOKUP[key(text)] || null;
}

export function teamName(abbr) {
  return TEAMS[abbr]?.name || abbr;
}
