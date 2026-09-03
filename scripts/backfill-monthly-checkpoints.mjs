// On-demand: replaces the quarterly race-chart checkpoints with monthly
// ones across all three seasons. FY24/FY25 are closed, so this fetches a
// full new set of monthly historical closes for every person + benchmark
// (their existing `prices`/`changes` arrays stay untouched -- those still
// drive the quarterly Leaderboard columns, only the "monthlyPrices" field
// added here feeds the race chart). FY26 is ongoing, so only completed
// months are backfilled here; the season's current in-progress month is
// represented by the live price at render time, same as before.
//
// Uses the same "closest bar by absolute distance, reject if >10 days off"
// selection logic as the other backfill scripts, so a bad fetch surfaces as
// a null gap instead of a wrong number. Run via the "Backfill monthly
// checkpoints" GitHub Action, workflow_dispatch only.
import { readFile, writeFile } from 'node:fs/promises'

const YEAR1_PATH = new URL('../src/data/year1.json', import.meta.url)
const YEAR2_PATH = new URL('../src/data/year2.json', import.meta.url)
const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)

const year1 = JSON.parse(await readFile(YEAR1_PATH, 'utf8'))
const year2 = JSON.parse(await readFile(YEAR2_PATH, 'utf8'))
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))

const toYahoo = (t) => t.trim().replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// FY26 is ongoing, so a mid-season split (unlike FY24/FY25, whose checkpoints
// are all fetched fresh, after the fact, on one consistent post-split basis)
// leaves some checkpoint dates on the old share basis and some on the new one
// within the SAME array -- a fake multi-hundred-percent jump right where the
// split falls. Rescale every checkpoint before the split date to the current
// (post-split) basis so the whole array stays on one consistent basis, same
// as openingPrice already is. Add an entry here the day a new split is found.
const KNOWN_SPLITS = { BYND: { ratio: 30, before: '2026-08-14' } }
function applySplitAdjustment(ticker, dates, prices) {
  const split = KNOWN_SPLITS[ticker]
  if (!split) return prices
  return prices.map((v, i) => (v != null && dates[i] < split.before ? Math.round(v * split.ratio * 10000) / 10000 : v))
}

// Monthly dates from startStr, stepping by 1 calendar month, stopping once
// a step reaches/exceeds boundStr. includeBound appends boundStr itself as
// the final point (for a closed season's real end date); omit it for an
// ongoing season, where "now" is represented live at render time instead.
function monthlyCheckpoints(startStr, boundStr, includeBound) {
  const start = new Date(`${startStr}T00:00:00Z`)
  const bound = new Date(`${boundStr}T00:00:00Z`)
  const dates = [startStr]
  let d = new Date(start)
  while (true) {
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
    if (d >= bound) break
    dates.push(d.toISOString().slice(0, 10))
  }
  if (includeBound) dates.push(boundStr)
  return dates
}

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

  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < timestamps.length; i++) {
    if (!Number.isFinite(closes[i])) continue
    const dist = Math.abs(timestamps[i] * 1000 - targetDate.getTime())
    if (dist < bestDist) { bestDist = dist; bestIdx = i }
  }
  const price = closes[bestIdx]
  if (!Number.isFinite(price)) throw new Error('no close price in window')
  if (bestDist > 10 * 86400000) throw new Error(`closest bar is ${Math.round(bestDist / 86400000)}d from target`)
  return Math.round(price * 100) / 100
}

async function backfillSeason(label, dates, entities) {
  const byTicker = new Map()
  for (const e of entities) {
    const key = e.ticker.trim()
    if (!byTicker.has(key)) byTicker.set(key, [])
    byTicker.get(key).push(e)
  }

  let updated = 0
  const failed = []
  for (const [ticker, group] of byTicker) {
    const prices = []
    let ok = true
    for (const dateStr of dates) {
      try {
        prices.push(await fetchHistoricalClose(ticker, new Date(`${dateStr}T00:00:00Z`)))
      } catch (err) {
        failed.push(`${label}:${ticker}@${dateStr} (${err.message})`)
        prices.push(null)
        ok = false
      }
      await sleep(300)
    }
    for (const e of group) e.monthlyPrices = prices
    if (ok) updated++
  }
  console.log(`${label}: backfilled monthly prices for ${updated}/${byTicker.size} tickers fully.`)
  return failed
}

const allFailed = []

// FY24 -- closed season, real end date.
const y1Dates = monthlyCheckpoints(year1.dates[0], year1.dates[year1.dates.length - 1], true)
year1.monthlyDates = y1Dates
allFailed.push(...(await backfillSeason('FY24', y1Dates, [...year1.people, ...year1.benchmarks])))

// FY25 -- closed season, real end date.
const y2Dates = monthlyCheckpoints(year2.dates[0], year2.dates[year2.dates.length - 1], true)
year2.monthlyDates = y2Dates
allFailed.push(...(await backfillSeason('FY25', y2Dates, [...year2.people, ...year2.benchmarks])))

// FY26 -- ongoing season, only completed months; "now" stays live-rendered.
const todayStr = new Date().toISOString().slice(0, 10)
const y3Dates = monthlyCheckpoints(year3.seasonOpened, todayStr, false)
year3.checkpointDates = y3Dates
allFailed.push(
  ...(await backfillSeason('FY26', y3Dates, [...year3.people, ...year3.benchmarks]).then((failed) => {
    // Reuse the existing checkpointPrices field name (only the race chart
    // reads it) -- backfillSeason wrote monthlyPrices, copy it over. Only
    // FY26 is ongoing, so only it needs mid-season split rescaling (FY24/
    // FY25's checkpoints are all fetched fresh, after the fact, on one
    // consistent basis already).
    for (const e of [...year3.people, ...year3.benchmarks]) {
      e.checkpointPrices = applySplitAdjustment(e.ticker, y3Dates, e.monthlyPrices)
      delete e.monthlyPrices
    }
    return failed
  }))
)

await writeFile(YEAR1_PATH, JSON.stringify(year1, null, 1) + '\n')
await writeFile(YEAR2_PATH, JSON.stringify(year2, null, 1) + '\n')
await writeFile(YEAR3_PATH, JSON.stringify(year3, null, 1) + '\n')

console.log(`\nMonthly checkpoints: FY24 ${y1Dates.length} dates, FY25 ${y2Dates.length} dates, FY26 ${y3Dates.length} dates.`)
if (allFailed.length) console.log(`Gaps (${allFailed.length}):\n` + allFailed.join('\n'))
