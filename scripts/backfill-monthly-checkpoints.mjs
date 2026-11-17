// On-demand: refreshes the current season's (FY27) monthly race-chart
// checkpoints. FY24-FY26 are closed and frozen -- their checkpoints must NOT
// be re-run through this script (re-fetching would overwrite FY26's
// hand-set corporate-action final values and re-baseline its opening
// point), so only the ongoing season is touched. Only completed months are
// backfilled; the in-progress month is represented by the live price at
// render time. Checkpoint 0 is the season's openingPrice (the prior close
// the picks were priced from), not a fetched bar.
//
// Each checkpoint is the last trading bar ON OR BEFORE its date. Run via
// the "Backfill monthly checkpoints" GitHub Action, workflow_dispatch only.
import { readFile, writeFile } from 'node:fs/promises'

const YEAR4_PATH = new URL('../src/data/year4.json', import.meta.url)
const year4 = JSON.parse(await readFile(YEAR4_PATH, 'utf8'))

const toYahoo = (t) => t.trim().replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

  // Last trading bar on or before the target date. Picking the bar nearest
  // to midnight UTC grabs the PRIOR trading day's bar (it is closer than
  // the target day's own 13:30 UTC bar), which shifted every checkpoint a day early.
  const targetDay = targetDate.toISOString().slice(0, 10)
  let bestIdx = -1
  let bestDist = 0
  for (let i = 0; i < timestamps.length; i++) {
    if (!Number.isFinite(closes[i])) continue
    if (new Date(timestamps[i] * 1000).toISOString().slice(0, 10) <= targetDay) {
      bestIdx = i
      bestDist = Math.abs(timestamps[i] * 1000 - targetDate.getTime())
    }
  }
  if (bestIdx < 0) throw new Error('no bar on or before target date')
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

// FY27 -- ongoing season, only completed months; "now" stays live-rendered.
const todayStr = new Date().toISOString().slice(0, 10)
const y4Dates = monthlyCheckpoints(year4.seasonOpened, todayStr, false)
year4.checkpointDates = y4Dates
const entities = [...year4.people, ...year4.benchmarks]
const allFailed = await backfillSeason('FY27', y4Dates.slice(1), entities)
for (const e of entities) {
  // monthlyPrices covers dates 1..n; prepend the opening price as checkpoint 0.
  e.checkpointPrices = [e.openingPrice, ...(e.monthlyPrices ?? [])]
  delete e.monthlyPrices
}

await writeFile(YEAR4_PATH, JSON.stringify(year4, null, 1) + '\n')

console.log(`\nMonthly checkpoints: FY27 ${y4Dates.length} dates.`)
if (allFailed.length) console.log(`Gaps (${allFailed.length}):\n` + allFailed.join('\n'))
