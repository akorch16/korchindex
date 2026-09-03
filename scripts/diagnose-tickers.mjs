// One-off diagnostic: identify REVG, FSST, BITF via authoritative,
// keyless/anonymous sources -- SEC's official ticker registry (confirms
// whether a symbol is currently SEC-registered, with company name + CIK)
// and OpenFIGI's anonymous mapping API (Bloomberg instrument identifiers,
// works without a key at low volume). Not part of the regular pipeline --
// read logs from the "Diagnose tickers" run, then delete this + its
// workflow once resolved.
const TICKERS = ['REVG', 'FSST', 'BITF']

async function checkSecRegistry(tickers) {
  console.log('\n=== SEC company_tickers.json ===')
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'korchindex research contact@korch.co' },
  })
  console.log(`HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return }
  const json = await res.json()
  const entries = Object.values(json)
  console.log(`total entries: ${entries.length}`)
  for (const t of tickers) {
    const match = entries.find((e) => e.ticker === t)
    console.log(`  ${t}: ${match ? `CIK=${match.cik_str}, name="${match.title}"` : 'NOT FOUND in current SEC registry'}`)
  }
}

async function checkOpenFigi(tickers) {
  console.log('\n=== OpenFIGI mapping (anonymous) ===')
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
      for (const d of (result.data ?? []).slice(0, 5)) {
        console.log(`  ${tickers[i]}: figi=${d.figi} | name="${d.name}" | exch=${d.exchCode} | ticker=${d.ticker} | securityType=${d.securityType} | marketSector=${d.marketSector}`)
      }
    }
  })
}

await checkSecRegistry(TICKERS)
await checkOpenFigi(TICKERS)
