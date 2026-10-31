// Fetches NFL regular-season results from ESPN's public scoreboard API and
// boils them down to a small, simple format. Used both by the web page (in the
// browser) and by the GitHub Action (scripts/update-scores.js, in Node).
//
// Output format (also what data/scores.json looks like):
// {
//   updated: "2026-10-31T19:00:00.000Z",
//   season: 2026,
//   currentWeek: 9,
//   weeks: {
//     "1": [ { id, date, status: "final"|"live"|"upcoming"|"other", detail,
//              home: { team: "CAR", score: 24 }, away: { team: "NO", score: 17 } }, ... ],
//     ...
//   }
// }

import { normalizeAbbr } from './teams.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const REGULAR_SEASON_WEEKS = 18;

async function getJSON(url, fetchFn) {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`ESPN returned ${res.status} for ${url}`);
  return res.json();
}

function simplifyGame(ev) {
  const comp = ev.competitions?.[0] || {};
  const type = ev.status?.type || comp.status?.type || {};
  let status = 'other';
  if (type.completed) status = 'final';
  else if (type.state === 'in') status = 'live';
  else if (type.state === 'pre') status = 'upcoming';
  const side = (homeAway) => {
    const c = (comp.competitors || []).find((x) => x.homeAway === homeAway) || {};
    const score = status === 'upcoming' || c.score == null || c.score === '' ? null : Number(c.score?.value ?? c.score);
    return { team: normalizeAbbr(c.team?.abbreviation), score: Number.isFinite(score) ? score : null };
  };
  return {
    id: ev.id,
    date: ev.date,
    status,
    detail: type.shortDetail || type.detail || '',
    home: side('home'),
    away: side('away'),
  };
}

/** Download every regular-season week up to the current one. */
export async function fetchSeason(fetchFn = globalThis.fetch.bind(globalThis)) {
  const now = await getJSON(BASE, fetchFn);
  const season = now.season?.year ?? now.leagues?.[0]?.season?.year;
  const seasonType = now.season?.type ?? now.leagues?.[0]?.season?.type?.type;
  if (!season) throw new Error('ESPN response did not include a season');

  // 1 = preseason, 2 = regular season, 3 = playoffs, 4 = offseason
  let currentWeek;
  if (seasonType === 2) currentWeek = Math.min(Math.max(now.week?.number || 1, 1), REGULAR_SEASON_WEEKS);
  else if (seasonType === 1) currentWeek = 1;
  else currentWeek = REGULAR_SEASON_WEEKS;

  const weekNums = Array.from({ length: currentWeek }, (_, i) => i + 1);
  const results = await Promise.all(
    weekNums.map((w) => getJSON(`${BASE}?dates=${season}&seasontype=2&week=${w}`, fetchFn)),
  );

  const weeks = {};
  weekNums.forEach((w, i) => {
    weeks[w] = (results[i].events || []).map(simplifyGame).sort((a, b) => (a.date < b.date ? -1 : 1));
  });

  return { updated: new Date().toISOString(), season, currentWeek, weeks };
}
