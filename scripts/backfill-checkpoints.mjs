// On-demand: fetches each FY26 ticker's actual historical close on a list of
// checkpoint dates (season open + elapsed quarters) and writes them into
// year3.json as checkpointPrices, so the FY26 race chart can plot real
// quarterly data the same way FY24/FY25 do -- instead of just open vs. now.
// Only checkpoints that have actually occurred are listed here; the season's
// still-open quarter is represented by the live price at render time, not a
// backfilled one. Run via the "Backfill FY26 checkpoints" GitHub Action,
// workflow_dispatch only -- extend CHECKPOINT_DATES as more quarters land.
import { readFile, writeFile } from 'node:fs/promises'

const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))

// Season open + each elapsed quarter (~13 weeks apart). Add the next date
// here once that quarter has actually passed.
const CHECKPOINT_DATES = [year3.seasonOpened, '2026-01-28', '2026-04-28']

const toYahoo = (t) => t.trim().replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchHistoricalClose(ticker, targetDate) {
  const period1 = Math.floor(targetDate.getTime() / 1000) - 3 * 86400
  const period2 = Math.floor(targetDate.getTime() / 1000) + 3 * 86400
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const result = (await res.json())?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!timestamps?.length || !closes?.length) throw new Error('no historical data')

  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < timestamps.length; i++) {
    if (!Number.isFinite(closes[i])) continue
    const dist = Math.abs(timestamps[i] * 1000 - targetDate.getTime())
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  const price = closes[bestIdx]
  if (!Number.isFinite(price)) throw new Error('no close price in window')
  if (bestDist > 10 * 86400000) throw new Error(`closest bar is ${Math.round(bestDist / 86400000)}d from target`)
  return Math.round(price * 100) / 100
}

const entriesByTicker = new Map()
for (const p of [...year3.people, ...year3.benchmarks]) {
  const key = p.ticker.trim()
  if (!entriesByTicker.has(key)) entriesByTicker.set(key, [])
  entriesByTicker.get(key).push(p)
}

let updated = 0
const failed = []
for (const [ticker, entries] of entriesByTicker) {
  const checkpointPrices = []
  let ok = true
  for (const dateStr of CHECKPOINT_DATES) {
    try {
      checkpointPrices.push(await fetchHistoricalClose(ticker, new Date(`${dateStr}T00:00:00Z`)))
    } catch (err) {
      failed.push(`${ticker}@${dateStr} (${err.message})`)
      checkpointPrices.push(null)
      ok = false
    }
    await sleep(300)
  }
  for (const e of entries) e.checkpointPrices = checkpointPrices
  if (ok) updated++
}

year3.checkpointDates = CHECKPOINT_DATES
await writeFile(YEAR3_PATH, JSON.stringify(year3, null, 1) + '\n')

console.log(`Backfilled checkpoints (${CHECKPOINT_DATES.join(', ')}) for ${updated}/${entriesByTicker.size} tickers fully.`)
if (failed.length) console.log(`Gaps: ${failed.join(', ')}`)
