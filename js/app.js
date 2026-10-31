import { findTeam, teamName } from './teams.js';
import { fetchSeason } from './espn.js';

const REFRESH_MINUTES = 5;
const state = { pool: null, scores: null, source: null, liveError: null, week: null, followCurrent: true };

// ---------- picks.txt ----------

function parsePicks(text) {
  const people = [];
  const errors = [];
  let person = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = line.match(/^(?:(?:round|rd)?\s*(\d+)\s*[.):-]?\s+)?(.+?)\s*[-:]?\s+(wins?|loss|losses)\s*$/i);
    const team = m && !line.endsWith(':') ? findTeam(m[2]) : null;
    if (team) {
      if (!person) return errors.push(`Line ${i + 1}: "${line}" comes before any person's name.`);
      person.picks.push({
        team,
        type: /^w/i.test(m[3]) ? 'wins' : 'losses',
        round: m[1] ? Number(m[1]) : person.picks.length + 1,
        person: person.name,
      });
    } else if (m && !line.endsWith(':')) {
      errors.push(`Line ${i + 1}: couldn't find a team called "${m[2]}".`);
    } else {
      person = { name: line.replace(/:$/, '').trim(), picks: [] };
      people.push(person);
    }
  });
  return { people, errors };
}

// ---------- scoring ----------

function gameFor(week, team) {
  const games = state.scores?.weeks?.[week] || [];
  const g = games.find((x) => x.home.team === team || x.away.team === team);
  if (!g) return null;
  const home = g.home.team === team;
  return { game: g, us: home ? g.home : g.away, them: home ? g.away : g.home, home };
}

/** What a pick earned in one week: { points, kind, text } */
function pickWeek(pick, week) {
  const found = gameFor(week, pick.team);
  if (!found) {
    const anyGames = (state.scores?.weeks?.[week] || []).length > 0;
    return { points: 0, kind: 'none', text: anyGames ? 'bye week' : 'no games' };
  }
  const { game, us, them, home } = found;
  const opp = teamName(them.team);
  if (game.status === 'final') {
    const s = `${us.score}-${them.score}`;
    if (us.score === them.score) return { points: 0, kind: 'tie', text: `tied ${opp} ${s}` };
    const won = us.score > them.score;
    const points = (won && pick.type === 'wins') || (!won && pick.type === 'losses') ? 1 : 0;
    return { points, kind: points ? 'hit' : 'miss', text: won ? `beat ${opp} ${s}` : `lost to ${opp} ${s}` };
  }
  if (game.status === 'live') {
    return { points: 0, kind: 'live', text: `playing ${opp} now, ${us.score ?? 0}-${them.score ?? 0} · ${game.detail}` };
  }
  if (game.status === 'upcoming') {
    const when = new Date(game.date).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    return { points: 0, kind: 'upcoming', text: `${home ? 'vs' : 'at'} ${opp}, ${when}` };
  }
  return { points: 0, kind: 'none', text: `${home ? 'vs' : 'at'} ${opp}: ${game.detail || 'not played'}` };
}

function weekNumbers() {
  return Object.keys(state.scores?.weeks || {}).map(Number).sort((a, b) => a - b);
}

function seasonRecord(team) {
  const r = { w: 0, l: 0, t: 0 };
  for (const wk of weekNumbers()) {
    const f = gameFor(wk, team);
    if (!f || f.game.status !== 'final') continue;
    if (f.us.score > f.them.score) r.w++;
    else if (f.us.score < f.them.score) r.l++;
    else r.t++;
  }
  return r;
}

function pickSeasonPoints(pick) {
  const r = seasonRecord(pick.team);
  return { points: pick.type === 'wins' ? r.w : r.l, record: r };
}

const recordText = (r) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
const pickLabel = (p) => `${teamName(p.team)} ${p.type}`;
const pts = (n) => `${n} pt${n === 1 ? '' : 's'}`;

/** Ranks with ties sharing a place: 1, 2, 2, 4 */
function ranked(items, score) {
  const sorted = [...items].sort((a, b) => score(b) - score(a));
  return sorted.map((item, i) => {
    let rank = i + 1;
    while (rank > 1 && score(sorted[rank - 2]) === score(item)) rank--;
    return { item, rank };
  });
}

// ---------- rendering ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);

function renderStandings() {
  const rows = ranked(
    state.pool.people.map((p) => ({ ...p, total: p.picks.reduce((n, pk) => n + pickSeasonPoints(pk).points, 0) })),
    (p) => p.total,
  );
  $('standings').innerHTML = rows.length
    ? rows
        .map(({ item: p, rank }) => {
          const picks = p.picks
            .map((pk) => {
              const s = pickSeasonPoints(pk);
              return `<li><span class="rd">Rd ${pk.round}</span> <span class="pick ${pk.type}">${esc(pickLabel(pk))}</span>
                <span class="muted">(${recordText(s.record)})</span><span class="pts">${s.points}</span></li>`;
            })
            .join('');
          return `<details class="row">
            <summary><span class="rank">${rank}</span><span class="name">${esc(p.name)}</span><span class="total">${p.total}</span></summary>
            <ul class="picks">${picks}</ul></details>`;
        })
        .join('')
    : '<p class="muted">No picks yet — add some to picks.txt.</p>';
}

function renderWeek() {
  const weeks = weekNumbers();
  const sel = $('week-select');
  sel.innerHTML = weeks.map((w) => `<option value="${w}">Week ${w}</option>`).join('');
  if (!weeks.length) {
    $('week').innerHTML = '<p class="muted">No games loaded yet.</p>';
    return;
  }
  if (state.followCurrent || !weeks.includes(state.week)) state.week = state.scores.currentWeek || weeks[weeks.length - 1];
  sel.value = state.week;
  $('week-prev').disabled = state.week <= weeks[0];
  $('week-next').disabled = state.week >= weeks[weeks.length - 1];
  $('week-title').textContent = state.week === state.scores.currentWeek ? 'This week' : `Week ${state.week}`;

  const rows = ranked(
    state.pool.people.map((p) => {
      const results = p.picks.map((pk) => ({ pk, r: pickWeek(pk, state.week) }));
      return { ...p, results, total: results.reduce((n, x) => n + x.r.points, 0) };
    }),
    (p) => p.total,
  );
  $('week').innerHTML = rows
    .map(({ item: p, rank }) => {
      const lines = p.results
        .map(({ pk, r }) => {
          const shown = r.kind === 'live' || r.kind === 'upcoming' || r.kind === 'none' ? '–' : r.points;
          return `<li class="${r.kind}"><span class="pick ${pk.type}">${esc(pickLabel(pk))}:</span> <b>${shown}</b> <span class="muted">(${esc(r.text)})</span></li>`;
        })
        .join('');
      return `<div class="card">
        <div class="card-head"><span class="rank">${rank}</span><span class="name">${esc(p.name)}</span><span class="total">${p.total}</span></div>
        <ul class="week-picks">${lines}</ul></div>`;
    })
    .join('');
}

function renderTopPicks() {
  const all = state.pool.people.flatMap((p) => p.picks.map((pk) => ({ pk, ...pickSeasonPoints(pk) })));
  all.sort((a, b) => b.points - a.points || a.pk.round - b.pk.round); // ties: earlier round first
  $('top-picks').innerHTML = all
    .map((x) => {
      const rank = all.findIndex((y) => y.points === x.points) + 1;
      return `<li><span class="rank">${rank}</span>
        <span class="pick ${x.pk.type}">${esc(pickLabel(x.pk))}</span>
        <span class="who">(${esc(x.pk.person)}, Round ${x.pk.round})</span>
        <span class="pts">${x.points}</span></li>`;
    })
    .join('');
}

function renderUpdated() {
  const fmt = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  let html;
  if (state.source === 'live') {
    html = `Scores last updated <b>${fmt(state.scores.updated)}</b> · live from ESPN (refreshes every ${REFRESH_MINUTES} min)`;
  } else if (state.source === 'saved' && state.scores.updated) {
    html = `Scores last updated <b>${fmt(state.scores.updated)}</b> · from the saved copy (couldn't reach ESPN directly)`;
  } else {
    html = '<b>Couldn’t load any scores.</b> ESPN didn’t answer and there’s no saved copy yet.';
  }
  $('updated').innerHTML = html;
  $('season').textContent = state.scores?.season ? `${state.scores.season} season` : '';
}

function render() {
  if (!state.pool) return;
  $('errors').hidden = !state.pool.errors.length;
  $('errors').innerHTML = state.pool.errors.length
    ? `<b>Problem in picks.txt:</b><ul>${state.pool.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    : '';
  renderUpdated();
  renderStandings();
  renderWeek();
  renderTopPicks();
}

// ---------- loading ----------

async function loadScores() {
  try {
    state.scores = await fetchSeason();
    state.source = 'live';
  } catch (err) {
    console.warn('Live ESPN fetch failed, using saved copy:', err);
    try {
      const res = await fetch(`data/scores.json?t=${Date.now()}`);
      const saved = await res.json();
      // keep whatever we already showed if the saved copy is empty
      if (saved.updated || !state.scores) {
        state.scores = saved;
        state.source = 'saved';
      }
    } catch (e) {
      console.error('Could not load data/scores.json', e);
    }
  }
}

async function start() {
  try {
    const res = await fetch(`picks.txt?t=${Date.now()}`);
    if (!res.ok) throw new Error(res.status);
    state.pool = parsePicks(await res.text());
  } catch (e) {
    state.pool = { people: [], errors: [`Couldn't load picks.txt (${e.message}).`] };
  }
  await loadScores();
  render();
  setInterval(async () => {
    if (document.hidden) return;
    await loadScores();
    render();
  }, REFRESH_MINUTES * 60 * 1000);
}

function goToWeek(w) {
  state.week = Number(w);
  state.followCurrent = state.week === state.scores?.currentWeek;
  renderWeek();
}
$('week-select').addEventListener('change', (e) => goToWeek(e.target.value));
$('week-prev').addEventListener('click', () => goToWeek(state.week - 1));
$('week-next').addEventListener('click', () => goToWeek(state.week + 1));

start();
