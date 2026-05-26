# CRED Exchange

Standalone static site for **CRED Exchange**, starting from the agent reputation terminal that previously lived at `helixa.xyz/terminal`.

## What ships in v0.1

- `/` - CRED Exchange homepage and agent reputation scanner
- `/terminal` - compatibility rewrite to the homepage
- `/terminal/fallback.json` - static fallback data if the live API is unavailable

The v0.1 frontend still reads live data from `https://api.helixa.xyz` while CRED Protocol backend/API separation is planned.

## Local development

```bash
npm test
npm run dev
```

Then open `http://127.0.0.1:4173`.

## Vercel deployment

Import this GitHub repo into Vercel as a static project:

- Framework preset: Other
- Build command: leave empty
- Output directory: `.`
- Install command: leave empty or `npm install`
- Domain: `cred.exchange`

No environment variables are required for v0.1.
