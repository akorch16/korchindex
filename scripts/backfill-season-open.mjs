// One-off/on-demand backfill: fetches each FY26 ticker's actual historical close
// on the season-open date (year3.json's seasonOpened) from Yahoo Finance, and
// writes it into year3.json as the real openingPrice/openingDate -- replacing
// the "first day we could verify a price" placeholder used when the page first
// went up. Not part of the daily schedule; run manually (or reuse next season)
// via the "Backfill season open price" GitHub Action, workflow_dispatch only.
//
// Yahoo's chart endpoint accepts period1/period2 (unix seconds) for historical
// daily bars, unlike the range=5d form update-prices.mjs uses for "latest."
import { readFile, writeFile } from 'node:fs/promises'

const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))

const openDate = new Date(`${year3.seasonOpened}T00:00:00Z`)
// +/- 3 days so a weekend/holiday open still lands inside the fetched window.
const period1 = Math.floor(openDate.getTime() / 1000) - 3 * 86400
const period2 = Math.floor(openDate.getTime() / 1000) + 3 * 86400

const toYahoo = (t) => t.trim().replace('.', '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchHistoricalClose(ticker, targetDate) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const result = (await res.json())?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!timestamps?.length || !closes?.length) throw new Error('no historical data')

  // Pick the bar closest to the target date by absolute distance -- robust to
  // thin/illiquid tickers whose only bar in the window is a day or two off in
  // either direction (a "last bar on-or-before" rule silently fell through to
  // index 0 -- an arbitrary, possibly far-off bar -- when nothing qualified).
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
  // Sanity check: reject anything wildly off-target rather than silently
  // writing a misleading date (the failure then shows as "pending", not wrong).
  if (bestDist > 10 * 86400000) throw new Error(`closest bar is ${Math.round(bestDist / 86400000)}d from target`)
  const date = new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10)
  return { price: Math.round(price * 100) / 100, date }
}

// Dedupe by ticker (several people share a pick) so each symbol is fetched once.
const entriesByTicker = new Map()
for (const p of [...year3.people, ...year3.benchmarks]) {
  const key = p.ticker.trim()
  if (!entriesByTicker.has(key)) entriesByTicker.set(key, [])
  entriesByTicker.get(key).push(p)
}

let updated = 0
const failed = []
for (const [ticker, entries] of entriesByTicker) {
  try {
    const r = await fetchHistoricalClose(ticker, openDate)
    for (const e of entries) Object.assign(e, { openingPrice: r.price, openingDate: r.date })
    updated++
  } catch (err) {
    failed.push(`${ticker} (${err.message})`)
  }
  await sleep(300)
}

await writeFile(YEAR3_PATH, JSON.stringify(year3, null, 1) + '\n')

console.log(`Backfilled ${updated}/${entriesByTicker.size} season-open prices for ${year3.seasonOpened}.`)
if (failed.length) console.log(`Left as-is (no historical data found): ${failed.join(', ')}`)
