// ONE-OFF, not part of the site. Fetches each FY26 ticker's daily close on
// 2025-11-24 (a Monday) from Yahoo's public chart endpoint, for a one-time
// before/after Thanksgiving-week analysis. Prints JSON to stdout; read via
// GitHub Actions job logs since this sandbox can't reach Yahoo directly.
import { readFile } from 'node:fs/promises'

const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))

const TARGET_DATE = '2025-11-24'
// A few days of padding around the target so the daily-candle series
// definitely includes it regardless of weekend/holiday alignment.
const period1 = Math.floor(new Date('2025-11-20T00:00:00Z').getTime() / 1000)
const period2 = Math.floor(new Date('2025-11-27T00:00:00Z').getTime() / 1000)

const toYahoo = (t) => t.replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchCloseOn(ticker, dateStr) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    toYahoo(ticker)
  )}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-scratch' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const result = (await res.json())?.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  for (let i = 0; i < timestamps.length; i++) {
    const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    if (d === dateStr && closes[i] != null) return closes[i]
  }
  // fall back: closest prior trading day within the window
  let best = null
  for (let i = 0; i < timestamps.length; i++) {
    const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    if (d <= dateStr && closes[i] != null) best = { date: d, close: closes[i] }
  }
  return best ? `${best.close} (fallback: ${best.date})` : null
}

const out = {}
for (const p of year3.people) {
  const ticker = p.ticker.trim()
  if (ticker === 'FSST') {
    // Liquidated 2025-11-13, before the target date -- frozen payout.
    out[ticker] = { name: p.name, close: 30.8963, note: 'liquidated 2025-11-13, frozen payout' }
    continue
  }
  try {
    const close = await fetchCloseOn(ticker, TARGET_DATE)
    out[ticker] = { name: p.name, close }
  } catch (err) {
    out[ticker] = { name: p.name, close: null, error: err.message }
  }
  await sleep(250)
}

console.log('===NOV24_CLOSES_JSON_START===')
console.log(JSON.stringify(out, null, 1))
console.log('===NOV24_CLOSES_JSON_END===')
