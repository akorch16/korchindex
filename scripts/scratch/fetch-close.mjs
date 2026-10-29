import { readFile } from 'node:fs/promises'
const y3 = JSON.parse(await readFile(new URL('../../src/data/year3.json', import.meta.url), 'utf8'))
const tickers = [...new Set([...y3.people.map((p) => p.ticker.trim()), ...y3.benchmarks.map((b) => b.ticker), 'TEX', 'KEEL'])]
const targets = [...y3.checkpointDates, '2025-10-27', '2025-11-24', '2025-11-25']
const toYahoo = (t) => t.replace('.', '-')
const out = {}
for (const t of tickers) {
  try {
    const p1 = Math.floor(Date.parse('2025-10-20T00:00:00Z') / 1000), p2 = Math.floor(Date.parse('2026-10-31T00:00:00Z') / 1000)
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(t))}?period1=${p1}&period2=${p2}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0 korchindex' } })
    const r = (await res.json())?.chart?.result?.[0]
    const bars = (r?.timestamp ?? []).map((ts, i) => [new Date(ts * 1000).toISOString().slice(0, 10), r.indicators.quote[0].close[i]]).filter(([, c]) => Number.isFinite(c))
    out[t] = {}
    for (const d of targets) {
      const b = bars.filter(([bd]) => bd <= d).pop()
      out[t][d] = b ? [b[0], Math.round(b[1] * 10000) / 10000] : null
    }
  } catch (e) { out[t] = null }
  await new Promise((r) => setTimeout(r, 250))
}
console.log('CLOSES_JSON=' + JSON.stringify(out))
