// Once each morning, finds FY27's biggest mover over the previous trading
// day (open to close) and fetches a real news headline (Yahoo's search
// endpoint) plus a short summary snippet (Yahoo's RSS feed, which has a
// description the search endpoint lacks) -- same "no API key" approach as
// update-prices.mjs. Writes public/live/spotlight.json. Run by
// .github/workflows/update-prices.yml after every price update, but it
// exits early if today's spotlight already exists, so only the first run of
// the (Eastern) day does any work.
import { readFile, writeFile } from 'node:fs/promises'

const SPOTLIGHT_PATH = new URL('../public/live/spotlight.json', import.meta.url)
const YEAR4_PATH = new URL('../src/data/year4.json', import.meta.url)
const STOCK_NOTES_PATH = new URL('../src/data/stock-notes.json', import.meta.url)

const year4 = JSON.parse(await readFile(YEAR4_PATH, 'utf8'))
const stockNotes = JSON.parse(await readFile(STOCK_NOTES_PATH, 'utf8'))

// Yahoo symbol format: class shares use '-' (BRK.B -> BRK-B)
const toYahoo = (t) => t.replace('.', '-')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

let existing = null
try {
  existing = JSON.parse(await readFile(SPOTLIGHT_PATH, 'utf8'))
} catch {}
if (existing?.generatedOn === todayET) {
  console.log(`Spotlight already generated for ${todayET} -- leaving it as is.`)
  process.exit(0)
}

// Last completed daily bar strictly before today (Eastern), so Monday picks
// up Friday and a post-holiday morning picks up the last trading day.
async function previousSession(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}?range=5d&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  const q = r?.indicators?.quote?.[0]
  const bars = (r?.timestamp ?? [])
    .map((ts, i) => ({
      date: new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      open: q?.open?.[i],
      close: q?.close?.[i],
    }))
    .filter((b) => b.date < todayET && Number.isFinite(b.open) && Number.isFinite(b.close) && b.open !== 0)
  return bars.at(-1) ?? null
}

// Corporate-action picks (mergers, liquidations, rebrands) no longer trade
// under their original ticker -- skip them, since "why did it move" news
// for the successor company would be a confusing non sequitur here.
const candidates = []
for (const p of year4.people.filter((p) => !p.corporateAction)) {
  const ticker = p.ticker.trim()
  if (candidates.some((c) => c.ticker === ticker)) continue
  try {
    const bar = await previousSession(ticker)
    if (bar) candidates.push({ name: p.name, ticker, date: bar.date, price: bar.close, open: bar.open, changePct: (bar.close - bar.open) / bar.open })
  } catch (err) {
    console.log(`Previous-session lookup failed for ${ticker}: ${err.message}`)
  }
  await sleep(300)
}

// Compare everyone on the same (most recent) session.
const session = candidates.map((c) => c.date).sort().at(-1)
const sameSession = candidates.filter((c) => c.date === session)

if (sameSession.length === 0) {
  console.log('No previous-session data -- leaving spotlight.json untouched.')
  process.exit(0)
}

const mover = sameSession.reduce((a, b) => (Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a))

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
  date: mover.date,
  generatedOn: todayET,
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
