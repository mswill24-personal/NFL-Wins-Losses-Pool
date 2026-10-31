// Run by the GitHub Action (.github/workflows/update-scores.yml).
// Downloads the latest scores from ESPN and saves them to data/scores.json.
// The file is only rewritten when a score or game status actually changed.
//
// To run by hand:  node scripts/update-scores.js

import { readFile, writeFile } from 'node:fs/promises';
import { fetchSeason } from '../js/espn.js';

const file = new URL('../data/scores.json', import.meta.url);

const fresh = await fetchSeason();
const gameCount = Object.values(fresh.weeks).reduce((n, g) => n + g.length, 0);
if (gameCount === 0) throw new Error('ESPN returned no games; leaving data/scores.json alone.');

let old = null;
try {
  old = JSON.parse(await readFile(file, 'utf8'));
} catch {
  // first run, or file missing
}

const withoutTime = (d) => JSON.stringify({ ...d, updated: null });
if (old && withoutTime(old) === withoutTime(fresh)) {
  console.log('No score changes since last update.');
} else {
  await writeFile(file, JSON.stringify(fresh, null, 1) + '\n');
  console.log(`Saved ${gameCount} games through week ${fresh.currentWeek} of ${fresh.season}.`);
}
