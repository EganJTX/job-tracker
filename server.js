const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// ── Serve static files from this folder ──────────────────────────────────────
app.use('/job-tracker', express.static(__dirname));

// ── File paths (all relative to this folder) ─────────────────────────────────
const DATA_PATH        = path.join(__dirname, 'data.json');
const IDENTITY_PATH    = path.join(__dirname, 'identity.md');
const COVERLETTER_PATH = path.join(__dirname, 'cover_letter_style.md');

// ── Pipeline data ─────────────────────────────────────────────────────────────
app.get('/api/job-tracker/data', (req, res) => {
  if (!fs.existsSync(DATA_PATH)) return res.json(null);
  try {
    res.json(JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/job-tracker/data', (req, res) => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// ── Identity file ─────────────────────────────────────────────────────────────
app.get('/api/job-tracker/identity', (req, res) => {
  if (!fs.existsSync(IDENTITY_PATH)) return res.json({ content: '' });
  try {
    res.json({ content: fs.readFileSync(IDENTITY_PATH, 'utf8') });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read identity' });
  }
});

app.post('/api/job-tracker/identity', (req, res) => {
  try {
    fs.writeFileSync(IDENTITY_PATH, req.body.content || '', 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write identity' });
  }
});

// ── Cover letter style ────────────────────────────────────────────────────────
app.get('/api/job-tracker/coverletter', (req, res) => {
  if (!fs.existsSync(COVERLETTER_PATH)) return res.json({ content: '' });
  try {
    res.json({ content: fs.readFileSync(COVERLETTER_PATH, 'utf8') });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read cover letter' });
  }
});

app.post('/api/job-tracker/coverletter', (req, res) => {
  try {
    fs.writeFileSync(COVERLETTER_PATH, req.body.content || '', 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write cover letter' });
  }
});

// ── Bootstrap real (gitignored) files from committed .example templates ───────
// config.json / identity.md / cover_letter_style.md hold personal data and are
// gitignored. On first run they don't exist yet, so seed them from the
// fictional .example templates shipped in the repo. data.json is deliberately
// NOT bootstrapped — the pipeline should start empty, not pre-filled with
// example roles you'd have to delete one by one.
[
  ['config.example.json',              'config.json'],
  ['identity.example.md',              'identity.md'],
  ['cover_letter_style.example.md',    'cover_letter_style.md']
].forEach(([exampleName, realName]) => {
  const examplePath = path.join(__dirname, exampleName);
  const realPath     = path.join(__dirname, realName);
  if (!fs.existsSync(realPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, realPath);
    console.log(`${realName} not found — created from ${exampleName}`);
  }
});

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.get('/api/job-tracker/config', (req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) return res.json(null);
  try {
    res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/job-tracker/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write config' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Lighthouse running at http://localhost:${PORT}/job-tracker`);
});
