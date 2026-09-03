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

// BITF (Bitfarms) completed a US redomiciliation and 1:1 rebrand to KEEL
// effective 2026-04-06, per external research + confirmed via matching SEC
// CIK 1812477. Pre-rebrand checkpoints should use BITF; post-rebrand uses
// KEEL. Yahoo's wide-range query 404'd for BITF entirely (like FSST did) --
// try tight windows around each pre-rebrand date instead.
await fetchWindow('BITF', 'season-open window', '2025-10-20', '2025-11-05')
await fetchWindow('BITF', 'Jan checkpoint window', '2026-01-20', '2026-02-05')
await fetchWindow('BITF', 'around rebrand date', '2026-03-28', '2026-04-10')
await fetchWindow('KEEL', 'Apr checkpoint window', '2026-04-20', '2026-05-05')
