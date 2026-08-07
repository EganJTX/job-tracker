# Lighthouse — Job Tracker / Job Scorer

A local, single-user app for tracking and scoring job opportunities during a job search. Runs on your own machine, keeps your data on your own machine, and pairs with an AI project you set up separately to do the actual scoring.

**[View the live demo](demo.html)** — a fully self-contained walkthrough with a fictional persona ("John Doe") and a made-up pipeline of fictional companies. No install, no server, nothing sent anywhere.

## What this is (and isn't)

Lighthouse is **not** an AI app by itself — it has no built-in LLM calls. It's the hub of a three-part system:

1. **Lighthouse (this app)** — your pipeline tracker and identity-file generator. It stores your scored roles, and it turns a form you fill out once into two files: `identity.md` (who you are, what you're looking for) and a set of scorer instructions.
2. **Job Scorer bot (external, required)** — a Claude Project, ChatGPT custom GPT, Gemini Gem, or any AI tool that lets you set persistent instructions and attach files. You set it up once, paste in the scorer instructions Lighthouse generates, attach `identity.md`, and it does the actual work of scoring job descriptions you paste to it.
3. **Career Coach bot (external, optional)** — a separate companion AI project for interview prep and search accountability. Not required for scoring.

The day-to-day loop: paste a job description to your Job Scorer bot → it returns a score, verdict, and cover letter angles → at the end of a session, export the scored roles as JSON from the bot → import that JSON into Lighthouse → Lighthouse merges it into your pipeline without overwriting status changes you've made here. The in-app **Instructions** tab walks through this setup step by step.

## Setup

```bash
npm install
npm start
```

Then open `http://localhost:3000/job-tracker`. (`start.bat` does the same thing plus opens Chrome, if you're on Windows.)

On first run, `config.json`, `identity.md`, and `cover_letter_style.md` don't exist yet — the server creates them automatically from the committed `.example` templates in this repo, seeded with a fictional starter profile. Open the **Config** tab and replace it with your own. Your pipeline (`data.json`) starts genuinely empty; it's created the first time you add or import a role.

## Data and privacy

`config.json`, `identity.md`, `cover_letter_style.md`, and `data.json` are gitignored — once you fill them in with your real information, none of it is tracked by git or leaves your machine. Everything the app does is local file reads/writes through a small Express server (`server.js`); there's no database and no external API calls anywhere in the app itself.

## Data model

Each pipeline entry follows this shape:

```json
{
  "id": "", "title": "", "company": "",
  "status": "scored | applied | interview-recruiter | interview-hiringmgr | interview-panel | offer | ghosted | shelved | rejected | passed",
  "verdict": "priority | strong | maybe | borderline | skip",
  "score": 0, "domain": "", "resumeVariant": "",
  "dateAdded": "YYYY-MM-DD", "source": "", "url": "",
  "angles": [], "flags": { "positive": [], "negative": [], "caution": [] },
  "notes": "", "feedbackExternal": "", "feedbackMine": "",
  "lastModified": "YYYY-MM-DD", "peakStatus": ""
}
```

Verdict tiers: 85%+ Priority · 70-84% Strong · 55-69% Maybe · 40-54% Borderline · below 40% Skip. Full status/verdict reference is in the app's Instructions tab.

## License

[CC BY-NC 4.0](LICENSE) — Attribution-NonCommercial.
