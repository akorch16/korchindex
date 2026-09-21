// One-off diagnostic: verify KEEL's identity, price history, and any splits
// since the BITF -> KEEL rebrand (2026-04-06), because a user reported
// Robinhood shows KEEL at -9.15% overall on their BITF-converted position,
// which is wildly inconsistent with year3.json's current calc (+106.7%,
// live KEEL price $4.01 vs BITF's original $1.94 opening price, 1:1 ratio).
import { writeFile } from 'node:fs/promises'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const log = (...args) => {
  console.log(...args)
  out.push(args.map(String).join(' '))
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-diagnose' },
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 2000) }
}

async function chartFull(ticker, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}&events=splits,div`
  return fetchJson(url)
}

async function quoteSummary(ticker) {
  const modules = 'price,summaryDetail,quoteType'
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`
  return fetchJson(url)
}

async function searchYahoo(q) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}`
  return fetchJson(url)
}

log('=== KEEL: quoteSummary (name/type/exchange) ===')
{
  const r = await quoteSummary('KEEL')
  log('status', r.status)
  if (r.json?.quoteSummary?.result?.[0]) {
    const res = r.json.quoteSummary.result[0]
    log('longName', res.price?.longName)
    log('shortName', res.price?.shortName)
    log('exchangeName', res.price?.exchangeName)
    log('quoteType', res.quoteType?.quoteType)
    log('currency', res.price?.currency)
    log('regularMarketPrice', res.price?.regularMarketPrice?.raw)
    log('marketCap', res.price?.marketCap?.raw)
  } else {
    log('no quoteSummary result. raw:', JSON.stringify(r.json).slice(0, 500))
  }
}
await sleep(400)

log('\n=== KEEL: 1y chart (meta + splits + last 10 closes) ===')
{
  const r = await chartFull('KEEL', '1y')
  const result = r.json?.chart?.result?.[0]
  if (result) {
    log('meta.currency', result.meta?.currency)
    log('meta.exchangeName', result.meta?.exchangeName)
    log('meta.instrumentType', result.meta?.instrumentType)
    log('meta.regularMarketPrice', result.meta?.regularMarketPrice)
    log('meta.fiftyTwoWeekHigh', result.meta?.fiftyTwoWeekHigh)
    log('meta.fiftyTwoWeekLow', result.meta?.fiftyTwoWeekLow)
    const splits = result.events?.splits
    log('splits:', splits ? JSON.stringify(splits) : 'none')
    const ts = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []
    const last10 = ts.slice(-10).map((t, i) => {
      const idx = ts.length - 10 + i
      return `${new Date(t * 1000).toISOString().slice(0, 10)}: ${closes[idx]}`
    })
    log('last 10 closes:', JSON.stringify(last10, null, 0))
    // price around the rebrand date 2026-04-06
    const target = new Date('2026-04-06T00:00:00Z').getTime()
    let bestI = -1
    let bestD = Infinity
    ts.forEach((t, i) => {
      const d = Math.abs(t * 1000 - target)
      if (d < bestD && Number.isFinite(closes[i])) {
        bestD = d
        bestI = i
      }
    })
    if (bestI >= 0) {
      log(`closest close to 2026-04-06: ${new Date(ts[bestI] * 1000).toISOString().slice(0, 10)} = ${closes[bestI]} (${Math.round(bestD / 86400000)}d away)`)
    }
  } else {
    log('no chart result. raw:', r.text.slice(0, 500))
  }
}
await sleep(400)

log('\n=== Yahoo search for "KEEL" and "Keel Infrastructure" ===')
{
  const r1 = await searchYahoo('KEEL')
  log('search KEEL quotes:', JSON.stringify(r1.json?.quotes?.map((q) => ({ symbol: q.symbol, longname: q.longname || q.shortname, exch: q.exchange, typeDisp: q.typeDisp }))))
  await sleep(400)
  const r2 = await searchYahoo('Keel Infrastructure')
  log('search "Keel Infrastructure" quotes:', JSON.stringify(r2.json?.quotes?.map((q) => ({ symbol: q.symbol, longname: q.longname || q.shortname, exch: q.exchange, typeDisp: q.typeDisp }))))
}
await sleep(400)

log('\n=== BITF: quoteSummary + last chart data before rebrand (sanity check original ticker) ===')
{
  const r = await quoteSummary('BITF')
  log('BITF status', r.status)
  if (r.json?.quoteSummary?.result?.[0]) {
    const res = r.json.quoteSummary.result[0]
    log('BITF longName', res.price?.longName)
    log('BITF regularMarketPrice', res.price?.regularMarketPrice?.raw)
  } else {
    log('BITF no quoteSummary result. raw:', JSON.stringify(r.json).slice(0, 300))
  }
}

await writeFile(new URL('../keel-diagnosis.txt', import.meta.url), out.join('\n') + '\n')
console.log('\n\nWrote keel-diagnosis.txt')
