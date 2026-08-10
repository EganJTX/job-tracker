#!/usr/bin/env node
// Deterministic fallback for the ghosted-suggestion feature — fixed
// score-band -> grace-period formula. Superseded as the primary path by the
// agentic POST /api/evaluate-ghosted route in server.js, which uses Claude
// Code to reason about staleness vs. fit instead of a fixed formula. This
// script is kept around as an offline option when the Claude Code CLI isn't
// available. Advisory only — writes suggestedState / suggestedReasoning on
// each role, never touches status/peakStatus.
//
// Usage:
//   node scripts/suggest-ghosted.js            run and write data.json
//   node scripts/suggest-ghosted.js --dry-run  print what would change, write nothing
//
// Run this with the app tab closed (or reload after running) — if the app is
// open, its next in-app save will overwrite these suggestions with whatever
// was in memory when the tab was loaded.

const fs = require('fs');
const path = require('path');
const { isEligible, weeksSince } = require('./ghost-shared');

const DATA_PATH = path.join(__dirname, '..', 'data.json');

// Fit-score band -> grace period (weeks) before flagging as suggested-ghosted.
// Higher fit means more benefit of the doubt before suggesting you write it off.
const GRACE_BANDS = [
  { min: 80, label: 'strong fit',   weeks: 8 },
  { min: 60, label: 'good fit',     weeks: 6 },
  { min: 40, label: 'moderate fit', weeks: 5 },
  { min: 0,  label: 'weak fit',     weeks: 4 }
];

function bandFor(score) {
  return GRACE_BANDS.find(b => score >= b.min) || GRACE_BANDS[GRACE_BANDS.length - 1];
}

function run({ dryRun = false, now = new Date() } = {}) {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('No data.json found at ' + DATA_PATH);
    process.exit(1);
  }
  const store = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const roles = store.roles || [];

  let flagged = 0, cleared = 0, skipped = 0;

  roles.forEach(r => {
    if (!isEligible(r)) {
      skipped++;
      return;
    }

    const weeks = weeksSince(r.lastModified || r.dateAdded, now);
    const band  = bandFor(r.score || 0);

    if (weeks >= band.weeks) {
      r.suggestedState = 'ghosted';
      r.suggestedReasoning = `${weeks} weeks no movement, ${band.label} (score ${r.score}%) — consider a follow-up before writing off.`;
      flagged++;
      console.log(`FLAG  ${r.company} — ${r.title}: ${r.suggestedReasoning}`);
    } else if (r.suggestedState) {
      // Previously flagged but no longer meets the threshold (e.g. status moved since last run).
      r.suggestedState = null;
      r.suggestedReasoning = null;
      cleared++;
    }
  });

  console.log(`\n${flagged} flagged, ${cleared} cleared, ${skipped} skipped (terminal or not yet applied).`);

  if (!dryRun) {
    store.savedAt = now.toISOString();
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
    console.log('data.json updated.');
  } else {
    console.log('Dry run — data.json not written.');
  }
}

if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry-run') });
}

module.exports = { run, bandFor, GRACE_BANDS };
