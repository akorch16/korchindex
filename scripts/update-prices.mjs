// Fetches latest close prices for every tracked ticker from Stooq (free, no API key)
// and merges them into public/live/prices.json. Run by .github/workflows/update-prices.yml
// each weekday after US market close, or locally with `npm run update-prices`.
//
// Symbols are fetched one at a time — Stooq 404s large batched requests, and
// per-symbol requests let a delisted or unknown ticker fail without taking the
// rest down (previous values are kept).
import { readFile, writeFile } from 'node:fs/promises'

const PRICES_PATH = new URL('../public/live/prices.json', import.meta.url)
const YEAR2_PATH = new URL('../src/data/year2.json', import.meta.url)

const year2 = JSON.parse(await readFile(YEAR2_PATH, 'utf8'))
const tickers = [...new Set([...year2.people.map((p) => p.ticker.trim()), 'VOO', 'BRK.B'])]

// Stooq symbol format: lowercase, US listings suffixed .us, class shares use '-' (BRK.B -> brk-b.us)
const toStooq = (t) => t.replace('.', '-').toLowerCase() + '.us'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchQuote(ticker) {
  const url = `https://stooq.com/q/l/?s=${toStooq(ticker)}&f=sd2t2ohlcv&h&e=csv`
  const res = await fetch(url, { headers: { 'User-Agent': 'korchindex-price-updater' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const lines = (await res.text()).trim().split('\n')
  if (lines.length < 2) throw new Error('empty response')
  const [, date, , , , , close] = lines[1].split(',')
  const price = Number(close)
  if (!Number.isFinite(price)) throw new Error(`no data (${close})`)
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
    { updated: new Date().toISOString(), source: 'stooq.com', quotes },
    null,
    1
  ) + '\n'
)

console.log(`Updated ${updated}/${tickers.length} tickers.`)
if (failed.length) console.log(`Kept previous values for: ${failed.join(', ')}`)
