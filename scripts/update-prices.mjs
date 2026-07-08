// Fetches latest close prices for every tracked ticker from Stooq (free, no API key)
// and merges them into public/live/prices.json. Run by .github/workflows/update-prices.yml
// each weekday after US market close, or locally with `npm run update-prices`.
import { readFile, writeFile } from 'node:fs/promises'

const PRICES_PATH = new URL('../public/live/prices.json', import.meta.url)
const YEAR2_PATH = new URL('../src/data/year2.json', import.meta.url)

const year2 = JSON.parse(await readFile(YEAR2_PATH, 'utf8'))
const tickers = [...new Set([...year2.people.map((p) => p.ticker), 'VOO', 'BRK.B'])]

// Stooq symbol format: lowercase, US listings suffixed .us, class shares use '-' (BRK.B -> brk-b.us)
const toStooq = (t) => t.trim().replace('.', '-').toLowerCase() + '.us'
const fromStooq = (s) => s.replace(/\.us$/i, '').replace('-', '.').toUpperCase()

const url = `https://stooq.com/q/l/?s=${tickers.map(toStooq).join('+')}&f=sd2t2ohlcv&h&e=csv`
const res = await fetch(url)
if (!res.ok) {
  console.error(`Stooq request failed: ${res.status}`)
  process.exit(1)
}
const csv = await res.text()

let existing = { quotes: {} }
try {
  existing = JSON.parse(await readFile(PRICES_PATH, 'utf8'))
} catch {}

const quotes = { ...existing.quotes }
let updated = 0
const failed = []

for (const line of csv.trim().split('\n').slice(1)) {
  const [symbol, date, , , , , close] = line.split(',')
  const ticker = fromStooq(symbol)
  const price = Number(close)
  if (!Number.isFinite(price) || close === 'N/D') {
    failed.push(ticker)
    continue
  }
  quotes[ticker] = { price, date }
  updated++
}

await writeFile(
  PRICES_PATH,
  JSON.stringify(
    { updated: new Date().toISOString(), source: 'stooq.com', quotes },
    null,
    1
  ) + '\n'
)

console.log(`Updated ${updated}/${tickers.length} tickers.`)
if (failed.length) console.log(`No data for: ${failed.join(', ')} (kept previous values if any)`)
