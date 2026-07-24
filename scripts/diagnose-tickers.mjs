// One-off diagnostic: which of Google Finance, Twelve Data (no-key reference
// endpoint), Finnhub, and MarketWatch actually resolve BITF/FSST/REVG, before
// committing to an API provider. Not part of the regular pipeline -- read
// logs from the "Diagnose tickers" run, then delete this + its workflow.
const TICKERS = ['BITF', 'FSST', 'REVG']

async function tryGoogleFinance(ticker) {
  for (const exch of ['NASDAQ', 'NYSE', 'NYSEAMERICAN']) {
    const url = `https://www.google.com/finance/quote/${ticker}:${exch}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
    const text = await res.text()
    const priceMatch = text.match(/data-last-price="([\d.]+)"/)
    console.log(`  google finance ${exch}: HTTP ${res.status}, price=${priceMatch?.[1] ?? 'not found'}, len=${text.length}`)
    if (priceMatch) return
  }
}

async function tryTwelveDataSymbolSearch(ticker) {
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(ticker)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`  twelvedata symbol_search HTTP ${res.status}`)
  if (!res.ok) { console.log('   body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  for (const d of (json.data ?? []).slice(0, 5)) {
    console.log(`    ${d.symbol} | ${d.instrument_name} | exch=${d.exchange} | country=${d.country} | type=${d.instrument_type}`)
  }
  if (!json.data?.length) console.log('   no matches. raw:', JSON.stringify(json).slice(0, 300))
}

async function tryFinnhubSearch(ticker) {
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(ticker)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`  finnhub search (no token) HTTP ${res.status}`)
  if (!res.ok) { console.log('   body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  for (const d of (json.result ?? []).slice(0, 5)) {
    console.log(`    ${d.symbol} | ${d.description} | type=${d.type}`)
  }
  if (!json.result?.length) console.log('   no matches')
}

async function tryMarketWatch(ticker) {
  const url = `https://www.marketwatch.com/investing/stock/${ticker.toLowerCase()}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  const text = await res.text()
  const priceMatch = text.match(/"Last":"([\d.]+)"/) ?? text.match(/class="value">\$?([\d,.]+)</)
  console.log(`  marketwatch: HTTP ${res.status}, price=${priceMatch?.[1] ?? 'not found'}, len=${text.length}`)
}

for (const t of TICKERS) {
  console.log(`\n=== ${t} ===`)
  for (const fn of [tryGoogleFinance, tryTwelveDataSymbolSearch, tryFinnhubSearch, tryMarketWatch]) {
    try {
      await fn(t)
    } catch (err) {
      console.log(`  ${fn.name} FAILED: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}
