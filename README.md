# KORCH ↗

**A friends & family index fund.** One pick per person, ~$1,000 a pick, October to October.
Not financial advice — arguably the opposite.

This repo is the KORCH website: leaderboard, benchmark race, demographic showdowns
(Scott's vs. Alex's, SBHS vs. UCLA, Boomers vs. everyone), the annual newsletter, and a
live tracker.

## The record so far

| Season | KORCH | S&P 500 | Warren Buffett |
| --- | ---: | ---: | ---: |
| Year 1 (FY24) | +48.7%* | +22.1% | +21.8% |
| Year 2 (FY25) | **+19.8%** | +13.4% | +7.5% |

\* Equal-weight average of all 35 picks.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
```

Built with Vite + React. Charts are hand-rolled SVG. No backend.

## Data

- `src/data/year1.json` — FY24 picks, quarterly prices, and pick rationales
- `src/data/year2.json` — FY25 picks, quarterly prices, and benchmarks (VOO, BRK.B)
- `src/data/groups.json` — FY25 cohort return series (the showdown charts)
- `src/data/hold.json` — "diamond hands": Year 1 picks held through October 2025
- `public/live/prices.json` — latest close per ticker, updated automatically

## Automation

- **`.github/workflows/deploy.yml`** — builds and deploys the site to GitHub Pages on
  every push to `main`. One-time setup: in repo **Settings → Pages**, set Source to
  **GitHub Actions**.
- **`.github/workflows/update-prices.yml`** — weekdays after market close, fetches the
  latest prices from Stooq (`npm run update-prices`), commits `public/live/prices.json`,
  and redeploys. Also runnable manually from the Actions tab.

## Year 3

Opened October 10, 2025. Start thinking of your stock picks.
