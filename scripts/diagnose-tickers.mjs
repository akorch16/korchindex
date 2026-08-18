// One-off diagnostic: (1) check BYND for a reverse-split event that would
// explain its live price jumping from ~$0.91 to ~$11.63 with no real gain;
// (2) try bankruptcy/OTC-suffix ticker variants for REVG/FSST/BITF (a "Q"
// suffix is standard for companies in Chapter 11). Not part of the regular
// pipeline -- read logs from the "Diagnose tickers" run, then delete this +
// its workflow once resolved.
const toYahoo = (t) => t.trim().replace('.', '-')

async function checkSplits(ticker) {
  const period1 = Math.floor(new Date('2025-09-01T00:00:00Z').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}?period1=${period1}&period2=${period2}&interval=1d&events=split,div`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`\n=== ${ticker} splits/events === HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const splits = result?.events?.splits
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  const adjcloses = result?.indicators?.adjclose?.[0]?.adjclose
  console.log('splits found:', splits ? JSON.stringify(Object.values(splits)) : 'none')
  if (timestamps?.length) {
    // print last 10 bars raw close vs adjclose to spot a discontinuity
    const n = timestamps.length
    for (let i = Math.max(0, n - 12); i < n; i++) {
      const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
      console.log(`  ${d}: close=${closes[i]}  adjclose=${adjcloses?.[i]}`)
    }
  }
}

async function tryVariants(ticker) {
  console.log(`\n=== ${ticker} variants ===`)
  for (const suffix of ['Q', 'F', 'D', 'W']) {
    const symbol = `${ticker}${suffix}`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
    if (res.ok) {
      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      console.log(`  ${symbol}: HTTP 200, meta=${JSON.stringify({ longName: meta?.longName, exchangeName: meta?.exchangeName, regularMarketPrice: meta?.regularMarketPrice, instrumentType: meta?.instrumentType })}`)
    } else {
      console.log(`  ${symbol}: HTTP ${res.status}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

await checkSplits('BYND')
for (const t of ['REVG', 'FSST', 'BITF']) {
  await tryVariants(t)
}
