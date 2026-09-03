// One-off diagnostic: FSST (Fidelity Sustainable U.S. Equity ETF) was
// liquidated by Fidelity on 2025-11-13 (final close ~$30.88, cash payout
// $30.8963/share on 2025-11-25) -- confirmed via external research. It
// traded normally for years before that, including through the FY26
// season open (2025-10-28), so a tight window right around that date
// should surface a real opening price where our earlier wide-range query
// (which Yahoo apparently truncates post-delisting) did not. Not part of
// the regular pipeline -- read logs from the "Diagnose tickers" run, then
// delete this + its workflow once resolved.
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

// Tight window around the FY26 season open.
await fetchWindow('FSST', 'season-open window', '2025-10-20', '2025-11-05')
// Confirm the final trading window / liquidation close.
await fetchWindow('FSST', 'final trading window', '2025-11-05', '2025-11-20')
