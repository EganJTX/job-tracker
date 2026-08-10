// Core logic for the agentic ghosted-suggestion feature. Shells out to the
// Claude Code CLI in headless/print mode so the flagging decision is a
// reasoned judgment call (weighing staleness against fit), not a fixed
// formula. Claude Code is given no file/tool access — it only sees the
// compact candidate list and returns JSON; this module is solely
// responsible for reading/writing the data file, so a malformed or
// unexpected model response can never corrupt the file beyond the two
// advisory fields on matched roles.
//
// Exposed as a function of `dataPath` (rather than hardcoded to data.json)
// so it can be run against a copy for testing before touching real data —
// see the CLI entry point at the bottom of this file.

const fs = require('fs');
const { spawn } = require('child_process');
const { isEligible, weeksSince } = require('./ghost-shared');

const CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || 'claude';
const GHOST_EVAL_TIMEOUT_MS = Number(process.env.GHOST_EVAL_TIMEOUT_MS) || 120000;

function buildGhostPrompt(candidates, todayIso) {
  return [
    'You are reviewing a personal job-application tracker to flag applications',
    'that look like they have gone silent ("ghosted" by the employer) versus',
    'ones still worth waiting on.',
    '',
    `Today's date is ${todayIso}.`,
    '',
    'For each candidate below, weigh two signals using judgment — do not apply',
    'a fixed formula:',
    '1. weeksStale — weeks since last movement (higher = more silence).',
    '2. score — fit score, 0-100 (higher = stronger match).',
    '',
    'A higher fit score deserves more patience before being flagged as likely',
    'ghosted; a low fit score should be flagged sooner. You may use status',
    '(interview stage) as supporting context — e.g. a panel interview gone',
    'quiet for N weeks may be more notable than a recruiter screen gone quiet',
    'for the same N weeks — but weeksStale vs. score are the primary signals.',
    '',
    'Candidates (JSON):',
    JSON.stringify(candidates, null, 2),
    '',
    'For EVERY candidate above, decide whether it should be flagged as',
    'suggested-ghosted right now.',
    '',
    'Respond with ONLY a JSON array, no prose, no markdown code fences, one',
    'object per candidate, in this exact shape:',
    '[{ "id": "<candidate id>", "flagged": true|false, "reasoning": "<one sentence, <=25 words>" }]',
    '',
    'Reasoning style when flagged: "6 weeks no movement, moderate fit —',
    'consider a follow-up before writing off." When not flagged, briefly say',
    'why it is too early. Output nothing besides the JSON array.'
  ].join('\n');
}

// Resolves to { ok: true, flaggedCount, clearedCount, missing, totalCandidates, suggestions }
// or { ok: false, status, error, raw? } — never rejects, so callers (the
// Express route or a CLI test run) always get a plain result to report.
function runGhostEvaluation({ dataPath, now = new Date() } = {}) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dataPath)) {
      return resolve({ ok: false, status: 404, error: `No data file found at ${dataPath}` });
    }

    let store;
    try {
      store = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
      return resolve({ ok: false, status: 500, error: `Failed to read ${dataPath}: ${e.message}` });
    }

    const todayIso = now.toISOString().split('T')[0];
    const eligible = (store.roles || []).filter(isEligible);

    if (eligible.length === 0) {
      return resolve({ ok: true, flaggedCount: 0, clearedCount: 0, missing: 0, totalCandidates: 0, suggestions: [] });
    }

    const candidates = eligible.map(r => ({
      id:         r.id,
      company:    r.company,
      title:      r.title,
      status:     r.status,
      score:      r.score,
      weeksStale: weeksSince(r.lastModified || r.dateAdded, now)
    }));

    const prompt = buildGhostPrompt(candidates, todayIso);

    // Verified against `claude --help`: `--tools ""` disables all built-in
    // tools (confirmed against the installed CLI — 2.1.226). This is what
    // keeps Claude Code limited to pure reasoning over the candidate JSON
    // below, with no file/bash access, regardless of what the prompt says.
    //
    // shell:true is required on Windows to resolve the `claude` shim (a
    // .cmd file — Windows can't CreateProcess a .cmd directly). Node does
    // NOT escape argv under shell:true (DEP0190), so the empty-string value
    // is written as a literal `""` here rather than `''` — an actual empty
    // JS string would get silently dropped when the array is concatenated
    // into the command line, shifting how the next flag parses. Every other
    // argv entry is a short static literal with no spaces or shell
    // metacharacters, and the prompt itself goes over stdin, never argv.
    const child = spawn(CLAUDE_BIN, ['-p', '--output-format', 'json', '--tools', '""'], {
      cwd: __dirname,
      shell: true
    });

    let stdout = '', stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, status: 504, error: `Claude Code reasoning timed out after ${GHOST_EVAL_TIMEOUT_MS / 1000}s` });
    }, GHOST_EVAL_TIMEOUT_MS);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, status: 500, error: `Failed to launch Claude Code: ${err.message}` });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        return resolve({
          ok: false,
          status: 500,
          error: `Claude Code exited with code ${code}: ${stderr.slice(0, 500) || 'no stderr output'}`
        });
      }

      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch (e) {
        return resolve({ ok: false, status: 502, error: 'Could not parse Claude Code output as JSON', raw: stdout.slice(0, 1000) });
      }

      const resultText = envelope.result || '';
      let suggestions;
      try {
        const match = resultText.match(/\[[\s\S]*\]/);
        suggestions = JSON.parse(match ? match[0] : resultText);
      } catch (e) {
        return resolve({ ok: false, status: 502, error: 'Could not parse suggestions JSON from Claude Code result', raw: resultText.slice(0, 1000) });
      }

      if (!Array.isArray(suggestions)) {
        return resolve({ ok: false, status: 502, error: 'Claude Code result was not a JSON array', raw: resultText.slice(0, 1000) });
      }

      const byId = {};
      suggestions.forEach(s => { if (s && s.id) byId[s.id] = s; });

      let flaggedCount = 0, clearedCount = 0, missing = 0;
      eligible.forEach(role => {
        const s = byId[role.id];
        if (!s) { missing++; return; } // no verdict returned for this id — leave untouched
        if (s.flagged) {
          role.suggestedState     = 'ghosted';
          role.suggestedReasoning = String(s.reasoning || '').trim();
          flaggedCount++;
        } else {
          role.suggestedState     = null;
          role.suggestedReasoning = null;
          clearedCount++;
        }
      });

      try {
        store.savedAt = now.toISOString();
        fs.writeFileSync(dataPath, JSON.stringify(store, null, 2), 'utf8');
      } catch (e) {
        return resolve({ ok: false, status: 500, error: `Reasoning succeeded but failed to write ${dataPath}: ${e.message}` });
      }

      resolve({
        ok: true,
        flaggedCount,
        clearedCount,
        missing,
        totalCandidates: eligible.length,
        suggestions: eligible
          .filter(r => r.suggestedState === 'ghosted')
          .map(r => ({ id: r.id, company: r.company, title: r.title, reasoning: r.suggestedReasoning }))
      });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

if (require.main === module) {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error('Usage: node scripts/evaluate-ghosted.js <path-to-data-file>');
    process.exit(1);
  }
  runGhostEvaluation({ dataPath }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  });
}

module.exports = { runGhostEvaluation, buildGhostPrompt };
