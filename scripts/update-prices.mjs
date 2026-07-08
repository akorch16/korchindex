// Fetches the latest price for every tracked ticker from Yahoo Finance's public
// chart endpoint (free, no API key) and merges them into public/live/prices.json.
// Run by .github/workflows/update-prices.yml each weekday after US market close,
// or locally with `npm run update-prices`.
//
// Symbols are fetched one at a time so a delisted or unknown ticker fails alone
// and keeps its previous value. (Stooq was tried first but 404s all requests
// from GitHub Actions runner IPs.)
import { readFile, writeFile } from 'node:fs/promises'

const PRICES_PATH = new URL('../public/live/prices.json', import.meta.url)
const YEAR2_PATH = new URL('../src/data/year2.json', import.meta.url)

const year2 = JSON.parse(await readFile(YEAR2_PATH, 'utf8'))
const tickers = [...new Set([...year2.people.map((p) => p.ticker.trim()), 'VOO', 'BRK.B'])]

// Yahoo symbol format: class shares use '-' (BRK.B -> BRK-B)
const toYahoo = (t) => t.replace('.', '-')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    toYahoo(ticker)
  )}?interval=1d&range=5d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const meta = (await res.json())?.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(price)) throw new Error('no data')
  const date = new Date((meta.regularMarketTime ?? 0) * 1000).toISOString().slice(0, 10)
  return { price, date }
}

let existing = { quotes: {} }
try {
  existing = JSON.parse(await readFile(PRICES_PATH, 'utf8'))
} catch {}

const quotes = { ...existing.quotes }
let updated = 0
const failed = []

for (const ticker of tickers) {
  try {
    quotes[ticker] = await fetchQuote(ticker)
    updated++
  } catch (err) {
    failed.push(`${ticker} (${err.message})`)
  }
  await sleep(300)
}

if (updated === 0) {
  console.error('Every ticker failed — refusing to write. Failures:\n' + failed.join('\n'))
  process.exit(1)
}

await writeFile(
  PRICES_PATH,
  JSON.stringify(
    { updated: new Date().toISOString(), source: 'finance.yahoo.com', quotes },
    null,
    1
  ) + '\n'
)

console.log(`Updated ${updated}/${tickers.length} tickers.`)
if (failed.length) console.log(`Kept previous values for: ${failed.join(', ')}`)
