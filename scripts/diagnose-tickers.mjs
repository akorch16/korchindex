// One-off diagnostic: verify claim that BITF (Bitfarms) rebranded its
// ticker to KEEL. Check Yahoo chart, SEC registry, and OpenFIGI for KEEL,
// and see if OpenFIGI's KEEL entry cross-references Bitfarms. Not part of
// the regular pipeline -- read logs from the "Diagnose tickers" run, then
// delete this + its workflow once resolved.
async function checkYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } })
  console.log(`\n=== Yahoo chart: ${ticker} === HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const meta = result?.meta
  console.log('meta:', JSON.stringify({ symbol: meta?.symbol, longName: meta?.longName, shortName: meta?.shortName, exchangeName: meta?.exchangeName, regularMarketPrice: meta?.regularMarketPrice, instrumentType: meta?.instrumentType }))
}

async function checkSec(ticker) {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'korchindex research contact@korch.co' },
  })
  const json = await res.json()
  const match = Object.values(json).find((e) => e.ticker === ticker)
  console.log(`\n=== SEC registry: ${ticker} === ${match ? `CIK=${match.cik_str}, name="${match.title}"` : 'NOT FOUND'}`)
}

async function checkOpenFigi(tickers) {
  console.log('\n=== OpenFIGI mapping ===')
  const jobs = tickers.map((t) => ({ idType: 'TICKER', idValue: t }))
  const res = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobs),
  })
  console.log(`HTTP ${res.status}`)
  const text = await res.text()
  if (!res.ok) { console.log('body:', text.slice(0, 500)); return }
  const json = JSON.parse(text)
  json.forEach((result, i) => {
    if (result.error) {
      console.log(`  ${tickers[i]}: error="${result.error}"`)
    } else {
      for (const d of (result.data ?? []).slice(0, 8)) {
        console.log(`  ${tickers[i]}: figi=${d.figi} | name="${d.name}" | exch=${d.exchCode} | ticker=${d.ticker} | securityType=${d.securityType} | securityType2=${d.securityType2}`)
      }
    }
  })
}

await checkYahoo('KEEL')
await checkSec('KEEL')
await checkOpenFigi(['KEEL', 'BITF'])
