// Finds FY26's biggest mover since today's market open and fetches a real
// news headline (Yahoo's search endpoint) plus a short summary snippet
// (Yahoo's RSS feed, which has a description the search endpoint lacks) --
// same "no API key" approach as update-prices.mjs. Writes
// public/live/spotlight.json. Run by .github/workflows/update-prices.yml
// right after update-prices.mjs, since it reads that script's output.
import { readFile, writeFile } from 'node:fs/promises'

const PRICES_PATH = new URL('../public/live/prices.json', import.meta.url)
const SPOTLIGHT_PATH = new URL('../public/live/spotlight.json', import.meta.url)
const YEAR3_PATH = new URL('../src/data/year3.json', import.meta.url)
const STOCK_NOTES_PATH = new URL('../src/data/stock-notes.json', import.meta.url)

const prices = JSON.parse(await readFile(PRICES_PATH, 'utf8'))
const year3 = JSON.parse(await readFile(YEAR3_PATH, 'utf8'))
const stockNotes = JSON.parse(await readFile(STOCK_NOTES_PATH, 'utf8'))

// Corporate-action picks (mergers, liquidations, rebrands) no longer trade
// under their original ticker -- skip them, since "why did it move" news
// for the successor company would be a confusing non sequitur here.
const candidates = year3.people
  .filter((p) => !p.corporateAction)
  .map((p) => {
    const q = prices.quotes?.[p.ticker.trim()]
    if (q?.price == null || q?.open == null || q.open === 0) return null
    return { name: p.name, ticker: p.ticker.trim(), price: q.price, open: q.open, changePct: (q.price - q.open) / q.open }
  })
  .filter(Boolean)

if (candidates.length === 0) {
  console.log('No candidates with both price and open -- leaving spotlight.json untouched.')
  process.exit(0)
}

const mover = candidates.reduce((a, b) => (Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a))

async function fetchNews(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    ticker
  )}&newsCount=3&quotesCount=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const MAX_SUMMARY_LEN = 220

// The search endpoint above has no article body -- Yahoo's older RSS feed
// does, as a short <description> alongside the top headline. Best-effort
// only: some publishers' descriptions just repeat the title, and the feed
// occasionally has nothing at all for a thinly-covered ticker.
async function fetchRssSummary(ticker) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    toYahoo(ticker)
  )}&region=US&lang=en-US`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()
  const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1]
  const descMatch = item?.match(/<description>([\s\S]*?)<\/description>/)
  if (!descMatch) return null
  let desc = descMatch[1]
  desc = desc.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? desc
  desc = desc
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!desc) return null
  return desc.length > MAX_SUMMARY_LEN ? `${desc.slice(0, MAX_SUMMARY_LEN).trimEnd()}…` : desc
}

let companyName = stockNotes[mover.ticker]?.company ?? null
let headline = null
let publisher = null
let link = null
let publishedAt = null
let summary = null

try {
  const result = await fetchNews(mover.ticker)
  if (!companyName) {
    companyName = result?.quotes?.[0]?.longname ?? result?.quotes?.[0]?.shortname ?? null
  }
  const item = result?.news?.[0]
  if (item) {
    headline = item.title ?? null
    publisher = item.publisher ?? null
    link = item.link ?? null
    publishedAt = item.providerPublishTime
      ? new Date(item.providerPublishTime * 1000).toISOString()
      : null
  }
} catch (err) {
  console.log(`News lookup failed for ${mover.ticker}: ${err.message}`)
}

if (headline) {
  try {
    const rssSummary = await fetchRssSummary(mover.ticker)
    // Skip it if it's just the headline restated with no new information.
    if (rssSummary && rssSummary.toLowerCase() !== headline.toLowerCase()) {
      summary = rssSummary
    }
  } catch (err) {
    console.log(`RSS summary lookup failed for ${mover.ticker}: ${err.message}`)
  }
}

const spotlight = {
  date: new Date().toISOString().slice(0, 10),
  name: mover.name,
  ticker: mover.ticker,
  company: companyName ?? mover.ticker,
  changePct: mover.changePct,
  price: mover.price,
  open: mover.open,
  headline,
  summary,
  publisher,
  link,
  publishedAt,
}

await writeFile(SPOTLIGHT_PATH, JSON.stringify(spotlight, null, 1) + '\n')
console.log(
  `Spotlight: ${spotlight.ticker} (${spotlight.company}), ${(spotlight.changePct * 100).toFixed(1)}%` +
    `${headline ? ' -- headline found' : ' -- no headline found'}${summary ? ' + summary' : ''}`
)
