// One-off diagnostic: REV Group (REVG) merged into Terex Corp (TEX) on
// 2026-02-02, trading normally right up to its last day 2026-01-30 -- unlike
// BITF, which got fully purged from Yahoo's history when its symbol was
// retired. Check whether REVG's season-open (2025-10-28) price and TEX's
// current live price are fetchable. Not part of the regular pipeline --
// read logs from the "Diagnose tickers" run, then delete this + its
// workflow once resolved.
async function fetchWindow(ticker, label, period1Str, period2Str) {
  const period1 = Math.floor(new Date(`${period1Str}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(new Date(`${period2Str}T00:00:00Z`).getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' } })
  console.log(`\n=== ${ticker} ${label} (${period1Str}..${period2Str}) === HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!timestamps?.length) { console.log('no timestamps. meta:', JSON.stringify(result?.meta)); return }
  console.log(`bars: ${timestamps.length}`)
  for (let i = 0; i < timestamps.length; i++) {
    console.log(`  ${new Date(timestamps[i] * 1000).toISOString().slice(0, 10)}: close=${closes[i]}`)
  }
}

async function fetchLive(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' } })
  console.log(`\n=== ${ticker} live === HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return }
  const meta = (await res.json())?.chart?.result?.[0]?.meta
  console.log(`regularMarketPrice=${meta?.regularMarketPrice}, longName=${meta?.longName}, time=${new Date((meta?.regularMarketTime ?? 0) * 1000).toISOString()}`)
}

await fetchWindow('REVG', 'season-open window', '2025-10-20', '2025-11-05')
await fetchWindow('REVG', 'final trading window', '2026-01-20', '2026-02-05')
await fetchLive('TEX')
