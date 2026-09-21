// One-off: dump the full `meta` object from Yahoo's chart endpoint for one
// ticker to find the correct field name for "previous close" (needed for a
// 24-hour dollar-change module). Throwaway, deleted once resolved.
async function fetchMeta(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-diagnose' },
  })
  const json = await res.json()
  return json?.chart?.result?.[0]?.meta
}

for (const ticker of ['NVDA', 'MSTR']) {
  const meta = await fetchMeta(ticker)
  console.log(`\n=== ${ticker} meta ===`)
  console.log(JSON.stringify(meta, null, 2))
}
