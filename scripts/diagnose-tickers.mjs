// One-off diagnostic: BITF (Bitfarms) is dual-listed NASDAQ + TSX; if the
// NASDAQ leg got consolidated/delisted, the .TO listing may still resolve.
// FSST's symbol got reassigned to an unrelated ETF on Yahoo -- check if a
// suffixed variant (foreign listing) still has the original equity.
const CANDIDATES = ['BITF.TO', 'BITF.V', 'BITF.NE', 'FSST.TO', 'FSST.V']

const toYahoo = (t) => t.trim().replace('.', '-').replace('--', '.')
// Note: Yahoo suffix tickers use a literal dot for exchange (BITF.TO), only
// share-class dots (BRK.B) become dashes. Don't mangle exchange suffixes.
const yahooSymbol = (t) => (t.includes('.') && /^[A-Z]{1,5}\.[A-Z]{1,3}$/.test(t) && ['TO', 'V', 'NE', 'L'].includes(t.split('.')[1]) ? t : t.replace('.', '-'))

async function fetchWide(ticker) {
  const symbol = yahooSymbol(ticker)
  const period1 = Math.floor(new Date('2025-09-01T00:00:00Z').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  console.log(`\n=== ${ticker} (as ${symbol}) === HTTP ${res.status}`)
  if (!res.ok) {
    console.log('body:', (await res.text()).slice(0, 300))
    return
  }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!timestamps?.length) {
    console.log('no timestamps. meta:', JSON.stringify(result?.meta))
    return
  }
  console.log(`bars: ${timestamps.length}, first: ${new Date(timestamps[0] * 1000).toISOString().slice(0, 10)}, last: ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString().slice(0, 10)}, lastClose: ${closes[closes.length - 1]}`)
  console.log('meta:', JSON.stringify({ symbol: result?.meta?.symbol, exchangeName: result?.meta?.exchangeName, instrumentType: result?.meta?.instrumentType, currency: result?.meta?.currency, longName: result?.meta?.longName }))
}

for (const t of CANDIDATES) {
  try {
    await fetchWide(t)
  } catch (err) {
    console.log(`\n=== ${t} === FAILED: ${err.message}`)
  }
  await new Promise((r) => setTimeout(r, 300))
}
