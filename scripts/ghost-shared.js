// Shared candidate-eligibility rules for the ghosted-suggestion feature.
// Used by both the manual script (scripts/suggest-ghosted.js) and the
// agentic backend route (POST /api/evaluate-ghosted in server.js) so the
// two never drift apart on what counts as a candidate.

// Keep in sync with the TERMINAL constant in index.html.
const TERMINAL = ['ghosted', 'shelved', 'rejected', 'passed'];

// Statuses where silence is a meaningful ghosting signal. Excludes 'scored'
// (not yet applied — nothing to be ghosted from) and 'offer' (active
// negotiation, a different failure mode than silence).
const GHOST_ELIGIBLE = ['applied', 'interview-recruiter', 'interview-hiringmgr', 'interview-panel'];

function isEligible(role) {
  return !TERMINAL.includes(role.status) && GHOST_ELIGIBLE.includes(role.status);
}

function weeksSince(dateStr, now) {
  const then = new Date(dateStr);
  if (isNaN(then)) return 0;
  return Math.floor((now - then) / (1000 * 60 * 60 * 24 * 7));
}

module.exports = { TERMINAL, GHOST_ELIGIBLE, isEligible, weeksSince };
