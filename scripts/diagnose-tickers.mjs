// One-off diagnostic: BITF and FSST return 404/wrong-instrument from Yahoo's
// v8 chart endpoint, but both are confirmed still trading. Try alternate
// free, no-key sources to see what's actually available. Not part of the
// regular pipeline -- read the logs from the "Diagnose tickers" workflow
// run, then delete this + its workflow once resolved.
const TICKERS = ['BITF', 'FSST']

async function tryYahooSearch(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`  yahoo search HTTP ${res.status}`)
  if (!res.ok) return
  const json = await res.json()
  for (const q of json.quotes ?? []) {
    console.log(`    ${q.symbol} | ${q.shortname ?? q.longname ?? ''} | exch=${q.exchange} | type=${q.quoteType}`)
  }
}

async function tryYahooQuoteV7(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`  yahoo v7 quote HTTP ${res.status}`)
  if (!res.ok) { console.log('   body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  console.log('   result:', JSON.stringify(json?.quoteResponse?.result?.[0] ?? json?.quoteResponse))
}

async function tryNasdaqApi(ticker) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.nasdaq.com',
      Referer: 'https://www.nasdaq.com/',
    },
  })
  console.log(`  nasdaq.com HTTP ${res.status}`)
  if (!res.ok) { console.log('   body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  console.log('   data:', JSON.stringify(json?.data?.primaryData ?? json?.data).slice(0, 500))
}

async function tryStooq(ticker) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`  stooq.com HTTP ${res.status}`)
  const text = await res.text()
  console.log('   body (first 300 chars):', text.slice(0, 300))
}

for (const t of TICKERS) {
  console.log(`\n=== ${t} ===`)
  for (const fn of [tryYahooSearch, tryYahooQuoteV7, tryNasdaqApi, tryStooq]) {
    try {
      await fn(t)
    } catch (err) {
      console.log(`  ${fn.name} FAILED: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}
