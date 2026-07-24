// One-off diagnostic: why do REVG, FSST, BITF fail to get season-open /
// checkpoint prices? Fetches a wide historical window for each ticker and
// reports what data (if any) Yahoo actually has, plus the nearest bar to
// each date of interest. Not part of the regular pipeline -- read the logs
// from the "Diagnose tickers" workflow run, then delete this + its workflow.
const TICKERS = ['REVG', 'FSST', 'BITF']
const DATES_OF_INTEREST = ['2025-10-28', '2026-01-28', '2026-04-28']

const toYahoo = (t) => t.trim().replace('.', '-')

async function fetchWide(ticker) {
  // 2025-01-01 through now
  const period1 = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  console.log(`\n=== ${ticker} === HTTP ${res.status}`)
  if (!res.ok) {
    const body = await res.text()
    console.log('body:', body.slice(0, 500))
    return
  }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const error = json?.chart?.error
  if (error) console.log('chart.error:', JSON.stringify(error))
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!timestamps?.length) {
    console.log('no timestamps returned. meta:', JSON.stringify(result?.meta))
    return
  }
  console.log(`bars: ${timestamps.length}`)
  console.log(`first bar: ${new Date(timestamps[0] * 1000).toISOString().slice(0, 10)} close=${closes[0]}`)
  console.log(`last bar:  ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString().slice(0, 10)} close=${closes[timestamps.length - 1]}`)
  console.log('meta.symbol:', result?.meta?.symbol, 'exchangeName:', result?.meta?.exchangeName, 'instrumentType:', result?.meta?.instrumentType)

  for (const dateStr of DATES_OF_INTEREST) {
    const target = new Date(`${dateStr}T00:00:00Z`).getTime()
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < timestamps.length; i++) {
      if (!Number.isFinite(closes[i])) continue
      const dist = Math.abs(timestamps[i] * 1000 - target)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
    if (bestIdx === -1) {
      console.log(`  ${dateStr}: no valid close bar found at all`)
    } else {
      const days = Math.round(bestDist / 86400000)
      console.log(`  ${dateStr}: closest bar ${new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10)} close=${closes[bestIdx]} (${days}d away)`)
    }
  }
}

for (const t of TICKERS) {
  try {
    await fetchWide(t)
  } catch (err) {
    console.log(`\n=== ${t} === FETCH FAILED: ${err.message}`)
  }
  await new Promise((r) => setTimeout(r, 300))
}
