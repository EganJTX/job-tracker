# Lighthouse — Job Tracker / Job Scorer

A local, single-user app for tracking and scoring job opportunities during a job search. Runs on your own machine, keeps your data on your own machine, and pairs with an AI project you set up separately to do the actual scoring.

**[View the live demo](demo.html)** — a fully self-contained walkthrough with a fictional persona ("John Doe") and a made-up pipeline of fictional companies. No install, no server, nothing sent anywhere.

## What this is (and isn't)

Lighthouse's core isn't an AI app: scoring happens in an external Job Scorer bot you set up yourself. It does have one built-in AI feature, **Analyze**, which uses the Claude Code CLI to reason about which open applications look ghosted (see [Analyze](#analyze-spotting-ghosted-roles)). It's the hub of a three-part system:

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

## Analyze: spotting ghosted roles

The **Analyze** button hands Claude Code your open pipeline (how long each application has sat quiet, its fit score, and its interview stage) and asks it to judge, case by case, whether the silence is worth flagging or still within normal range. A strong-fit role earns more patience than a weak one, and stage context can shift the call either way, so there's no single fixed cutoff.

Flagged roles appear in a **Review** queue with a one-line rationale. You affirm a flag to move the role to Ghosted, or dismiss it to leave the role untouched. Nothing changes status without you saying so.

Analyze requires the [Claude Code CLI](https://claude.com/product/claude-code) installed and authenticated on your machine. Without it, everything else in Lighthouse works as normal.

## Data and privacy

`config.json`, `identity.md`, `cover_letter_style.md`, and `data.json` are gitignored: once you fill them in with your real information, none of it is tracked by git. Everything else is local file reads/writes through a small Express server (`server.js`) with no database.

The one exception is **Analyze**. When you click it, Lighthouse runs the Claude Code CLI in headless mode, with all tools disabled so it can't read your files, and passes it the company, title, status, score, and time-quiet for your open roles. Claude Code sends that to Anthropic under your own account. If you'd rather that data stay on your machine, don't use Analyze; nothing else depends on it.

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
  "lastModified": "YYYY-MM-DD", "peakStatus": "",
  "statusChangedAt": "YYYY-MM-DD", "appliedDate": "YYYY-MM-DD | null"
}
```

`peakStatus` is the furthest active stage a role ever reached. It moves forward automatically whenever `status` does and is never moved by a terminal status (ghosted / rejected / shelved / passed), so a role that was interviewed and later rejected still counts as interviewed. `statusChangedAt` is stamped only when `status` changes (unlike `lastModified`, which changes on any edit), and `appliedDate` is stamped once when a role first reaches Applied. Roles migrated from earlier versions have these backfilled from `lastModified` and are flagged `timingApprox: true`.

The header funnel (Assessed → Applied → Interviewed → Advanced) is computed from `peakStatus`, with each step shown as a percentage of the previous one and Advanced (past the hiring manager) also as a share of all applications.

Verdict tiers: 85%+ Priority · 70-84% Strong · 55-69% Maybe · 40-54% Borderline · below 40% Skip. Full status/verdict reference is in the app's Instructions tab.

## License

[CC BY-NC 4.0](LICENSE) — Attribution-NonCommercial.
