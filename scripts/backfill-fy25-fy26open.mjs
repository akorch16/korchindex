// One-off/on-demand: fetches each FY25 pick's actual historical close on
// 2025-10-27 (the date the FY26 season's own picks were priced from) and
// writes it into year2.json as `fy26OpenPrice`/`fy26OpenDate` -- a same-date
// baseline for the FY26 page's "Diamond hands" comparison. Diamond hands
// previously used FY25's own close (Oct 10, 2025) as the "held" baseline
// against a real FY26 pick priced from Oct 27/28, 2025 -- two different
// entry dates 2.5 weeks apart, so even a person who picked the same ticker
// both seasons showed a small non-zero "swing" that was really just normal
// price drift between those two dates, not a real switching decision. This
// field lets Diamond hands measure both sides from the same starting date.
//
// Not part of the daily schedule; run manually via the "Backfill FY25 picks'
// FY26-open price" GitHub Action, workflow_dispatch only. FY25 is a closed
// season, so this only needs to run once.
import { readFile, writeFile } from 'node:fs/promises'

const YEAR2_PATH = new URL('../src/data/year2.json', import.meta.url)
const year2 = JSON.parse(await readFile(YEAR2_PATH, 'utf8'))

const TARGET_DATE = '2025-10-27'
const targetDate = new Date(`${TARGET_DATE}T00:00:00Z`)
// +/- 3 days so a weekend/holiday open still lands inside the fetched window.
const period1 = Math.floor(targetDate.getTime() / 1000) - 3 * 86400
const period2 = Math.floor(targetDate.getTime() / 1000) + 3 * 86400

const toYahoo = (t) => t.trim().replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchHistoricalClose(ticker) {
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
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  const price = closes[bestIdx]
  if (!Number.isFinite(price)) throw new Error('no close price in window')
  if (bestDist > 10 * 86400000) throw new Error(`closest bar is ${Math.round(bestDist / 86400000)}d from target`)
  const date = new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10)
  return { price: Math.round(price * 100) / 100, date }
}

// Dedupe by ticker (several people can share a pick) so each symbol is fetched once.
const entriesByTicker = new Map()
for (const p of year2.people) {
  const key = p.ticker.trim()
  if (!entriesByTicker.has(key)) entriesByTicker.set(key, [])
  entriesByTicker.get(key).push(p)
}

let updated = 0
const failed = []
for (const [ticker, entries] of entriesByTicker) {
  try {
    const r = await fetchHistoricalClose(ticker)
    for (const e of entries) Object.assign(e, { fy26OpenPrice: r.price, fy26OpenDate: r.date })
    updated++
  } catch (err) {
    failed.push(`${ticker} (${err.message})`)
  }
  await sleep(300)
}

await writeFile(YEAR2_PATH, JSON.stringify(year2, null, 1) + '\n')

console.log(`Backfilled ${updated}/${entriesByTicker.size} FY25-pick prices as of ${TARGET_DATE}.`)
if (failed.length) console.log(`Left as-is (no historical data found): ${failed.join(', ')}`)
