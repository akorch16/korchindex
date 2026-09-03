// One-off diagnostic: Yahoo has fully purged REVG/FSST/BITF's pre-event
// history, so try the Wayback Machine -- free, keyless -- for archived
// snapshots of their Yahoo Finance quote pages around the target dates.
// A snapshot's HTML reflects whatever price Yahoo was showing at capture
// time, which could recover the real number. Not part of the regular
// pipeline -- read logs from the "Diagnose tickers" run, then delete this
// + its workflow once resolved.
const TARGETS = [
  { ticker: 'REVG', date: '2025-10-28' },
  { ticker: 'FSST', date: '2025-10-28' },
  { ticker: 'BITF', date: '2025-10-28' },
  { ticker: 'BITF', date: '2026-01-28' },
]

async function findSnapshots(ticker, targetDate) {
  const url = `https://finance.yahoo.com/quote/${ticker}/`
  const from = targetDate.replace(/-/g, '')
  const target = new Date(`${targetDate}T00:00:00Z`).getTime()
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&from=${from}&to=${from.slice(0, 4)}${String(Number(from.slice(4, 6)) + 1).padStart(2, '0')}01&filter=statuscode:200&limit=20`
  const res = await fetch(cdxUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-research' } })
  console.log(`\n=== ${ticker} @ ${targetDate}: CDX lookup === HTTP ${res.status}`)
  if (!res.ok) { console.log('body:', (await res.text()).slice(0, 300)); return null }
  const rows = await res.json()
  if (!rows || rows.length < 2) { console.log('no snapshots found in window'); return null }
  const [, ...data] = rows
  console.log(`found ${data.length} snapshot(s)`)
  // pick closest to target date
  let best = null
  let bestDist = Infinity
  for (const row of data) {
    const ts = row[1] // yyyyMMddHHmmss
    const snapDate = new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00Z`).getTime()
    const dist = Math.abs(snapDate - target)
    if (dist < bestDist) { bestDist = dist; best = ts }
  }
  console.log(`closest snapshot: ${best} (${Math.round(bestDist / 86400000)}d away)`)
  return best
}

async function extractPrice(ticker, snapshotTs) {
  const url = `https://web.archive.org/web/${snapshotTs}/https://finance.yahoo.com/quote/${ticker}/`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-research' } })
  console.log(`  fetch archived page: HTTP ${res.status}, len=${res.headers.get('content-length') ?? 'unknown'}`)
  if (!res.ok) return
  const html = await res.text()
  // Try a few known Yahoo price markers
  const patterns = [
    /data-symbol="[^"]*"[^>]*data-field="regularMarketPrice"[^>]*value="([\d.]+)"/,
    /"regularMarketPrice":\{"raw":([\d.]+)/,
    /data-testid="qsp-price"[^>]*>([\d,.]+)</,
  ]
  let found = false
  for (const p of patterns) {
    const m = html.match(p)
    if (m) { console.log(`  MATCH (${p.source.slice(0, 30)}...): ${m[1]}`); found = true }
  }
  if (!found) console.log(`  no price pattern matched (page length ${html.length})`)
}

for (const { ticker, date } of TARGETS) {
  const snap = await findSnapshots(ticker, date)
  if (snap) await extractPrice(ticker, snap)
  await new Promise((r) => setTimeout(r, 500))
}
