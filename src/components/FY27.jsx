import { useEffect, useMemo, useState } from 'react'
import LineChart, { RaceChart, Legend, fmtPct, fmtMoney } from './LineChart'
import year4 from '../data/year4.json'
import year3 from '../data/year3.json'
import year1 from '../data/year1.json'
import cohortMembership from '../data/cohort_membership.json'
import HeadToHead from './HeadToHead'
import HowKorchWorks from './HowKorchWorks'
import RosterTable from './RosterTable'
import StockSpotlight from './StockSpotlight'
import LogoStrip from './LogoStrip'
import { corporateActionValue, displayTicker, sinceTracking } from './FY26'

const STAKE = 1000

// Purely decorative -- KORCH has no relationship with any company shown.
const NOT_SPONSORED_LOGOS = [
  { file: 'logo-visa.webp', name: 'Visa' },
  { file: 'logo-amazon.webp', name: 'Amazon' },
  { file: 'logo-microsoft.webp', name: 'Microsoft' },
  { file: 'logo-nvidia.webp', name: 'NVIDIA' },
  { file: 'logo-meta.webp', name: 'Meta' },
  { file: 'logo-costco.webp', name: 'Costco' },
  { file: 'logo-shopify.webp', name: 'Shopify' },
]
const NOT_ENDORSED_LOGOS = [
  { file: 'logo-moderna.webp', name: 'Moderna' },
  { file: 'logo-asml.webp', name: 'ASML' },
  { file: 'logo-caterpillar.webp', name: 'Caterpillar' },
  { file: 'logo-servicenow.webp', name: 'ServiceNow' },
  { file: 'logo-reddit.webp', name: 'Reddit' },
  { file: 'logo-zscaler.webp', name: 'Zscaler' },
  { file: 'logo-nike.webp', name: 'Nike' },
]
const NOT_SUPPORTED_LOGOS = [
  { file: 'logo-palantir.webp', name: 'Palantir' },
  { file: 'logo-3m.webp', name: '3M' },
  { file: 'logo-figma.jpg', name: 'Figma' },
  { file: 'logo-kratos.webp', name: 'Kratos' },
  { file: 'logo-mp-materials.webp', name: 'MP Materials' },
  { file: 'logo-beyond-meat.webp', name: 'Beyond Meat' },
  { file: 'logo-nextera.webp', name: 'NextEra Energy' },
  { file: 'logo-supermicro.webp', name: 'Super Micro' },
  { file: 'logo-sweetgreen.webp', name: 'Sweetgreen' },
]

// Current dollar value of one person's $1,000 FY27 stake, and its dollar
// swing since today's market open -- both measured off the same $1,000
// basis scaled by price ratios, so a corporate-action pick (frozen payout,
// or a merger/rebrand's successor-share value) falls out of the same math
// with no special case: a frozen payout has today's price equal to today's
// open, so its swing is naturally $0.
function positionStats(p, quotes) {
  const caLive = corporateActionValue(p.corporateAction, quotes, 'price')
  const live = caLive ?? quotes?.[p.ticker]?.price ?? null
  const caOpen = corporateActionValue(p.corporateAction, quotes, 'open')
  const open = p.corporateAction ? caOpen : (quotes?.[p.ticker]?.open ?? null)

  const value = live != null && p.openingPrice != null ? STAKE * (live / p.openingPrice) : STAKE
  const sinceOpenReturn = live != null && open != null && open !== 0 ? (live - open) / open : null
  // Dollar change = value now minus value at today's open, so on the season's
  // opening day it reconciles exactly with (value - stake).
  const dollarChange = sinceOpenReturn != null && live != null ? value * ((live - open) / live) : 0
  return { value, dollarChange }
}

// Names recorded differently across seasons than in the FY25 spreadsheet
// (the source of cohortMembership) -- resolved by cross-season corroboration
// (see backend/scripts/derived/cohort_memberships.json history). Two are
// lower-confidence: Michelle Fried/Sullivan (plausible maiden->married name)
// and Suzanne Korchinski/Suzy Walker (corroborated via family role: she's
// marked "Wife" here and shares Jim Korchinski's surname, and Jim is a
// confirmed "Uncle" -- Aunts are specifically the Uncles' wives). Stephen
// Hosea has no known match at all -- not in the FY25 demographic roster.
const NAME_ALIASES = {
  'Alex Armstrong': 'Alexander Armstrong',
  'Allison Mitchell': 'Allie Mitchell',
  'Ana Kovacevic': 'Ana Sarmiento',
  'Betsy Polan': 'Betsy Arch',
  'Brenley MacEachern': 'Brenley',
  'Brit': 'Brittany Buckley',
  'Buckley': 'Scott Buckley',
  'Chris Morris': 'Christopher Morris',
  'Jamie': 'Jamie Armstrong',
  'Julia M': 'Julia Korchinski',
  'Karen Korchinski': 'Karin Korchinski',
  'Leala': 'Leala Wong',
  'Michelle Fried': 'Michelle Sullivan',
  'Natalie Tran': 'Natalie Lee',
  'Steve Hosea': 'Stephen Hosea',
  'Suzanne Korchinski': 'Suzy Walker',
  'Suzy': 'Suzy Walker',
  'Theo Lee': 'Theodore Lee',
  'Tim': 'Tim Morris',
  'Toe Withers': 'Victoria Withers',
}
const canonicalName = (name) => NAME_ALIASES[name] ?? name

const SHOWDOWNS = [
  { title: 'Scott’s vs. Alex’s', keys: ['Scott', 'Alex'] },
  {
    title: 'Santa Barbara High vs. UCLA',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS Grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA Grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  { title: 'Birth year', keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers', 'Gen Beta'] },
  { title: 'Men vs. Women', keys: ['Men', 'Women'] },
  { title: 'Uncles vs. Aunts vs. Cousins', keys: ['Uncles', 'Aunts', 'Cousins'] },
  { title: 'Country of birth', keys: ['Americans', 'Canadians', 'Mexicans', 'English'] },
  { title: 'Veterans vs. Newcomers', keys: ['Veterans', 'Newcomers'] },
  { title: 'My Wife vs. Everyone', keys: ['Wife'] },
]
const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)']

// "Nov 18, 2026 at 3:30 PM ET" -- when prices were last refreshed, in market time.
function refreshedLabel(updated) {
  const d = new Date(updated)
  const tz = { timeZone: 'America/New_York' }
  const date = d.toLocaleDateString('en-US', { ...tz, month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' })
  return `${date} at ${time} ET`
}

// [0, chg-at-Q1, chg-at-Q2, ..., chg-at-now] for one entity, from its
// backfilled checkpointPrices plus the live "now" price as the open quarter.
function series(entity, live) {
  const cps = entity.checkpointPrices
  const open = cps?.[0] ?? entity.openingPrice
  const chg = (p) => (open != null && p != null ? (p - open) / open : null)
  const historical = (cps ?? []).slice(1).map(chg)
  return [0, ...historical, chg(live)]
}

// Average several entities' series index-by-index, ignoring gaps.
function averageOf(seriesList) {
  const len = Math.max(0, ...seriesList.map((s) => s.length))
  return Array.from({ length: len }, (_, i) => {
    const vals = seriesList.map((s) => s[i]).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })
}

// Quarter-over-quarter winner/loser: biggest rise and fall within each
// quarter window specifically (not cumulative since the FY27 open), using
// the checkpointPrices indices for Nov 17 / Feb 17 / May 17 / Aug 17 --
// Q4 (Aug 17 -> now) uses the live price for its still-open end point.
const QUARTER_WINDOWS = [
  { label: 'Q1', sub: 'Nov 17 → Feb 17', startIdx: 0, endIdx: 3 },
  { label: 'Q2', sub: 'Feb 17 → May 17', startIdx: 3, endIdx: 6 },
  { label: 'Q3', sub: 'May 17 → Aug 17', startIdx: 6, endIdx: 9 },
  { label: 'Q4', sub: 'Aug 17 → now', startIdx: 9, endIdx: null },
]

function quarterExtremes(rows) {
  return QUARTER_WINDOWS.map(({ label, sub, startIdx, endIdx }) => {
    let best = null
    let worst = null
    for (const r of rows) {
      const start = r.checkpointPrices?.[startIdx]
      const end = endIdx != null ? r.checkpointPrices?.[endIdx] : r.live
      if (start == null || end == null) continue
      const qoq = (end - start) / start
      if (!best || qoq > best.qoq) best = { ticker: r.ticker, qoq }
      if (!worst || qoq < worst.qoq) worst = { ticker: r.ticker, qoq }
    }
    return { label, sub, best, worst }
  })
}

function QuarterChips({ rows }) {
  const qs = useMemo(() => quarterExtremes(rows), [rows])
  return (
    <div className="chips">
      {qs.map(({ label, sub, best, worst }) => (
        <div key={label} className="chip">
          <div className="q">{label} · {sub}</div>
          <div className="win">
            <span className="who">{best ? `▲ ${best.ticker} ${fmtPct(best.qoq, 0)}` : '—'}</span>
          </div>
          <div className="lose">
            <span className="who">{worst ? `▼ ${worst.ticker} ${fmtPct(worst.qoq, 0)}` : '—'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// For every FY26 pick, what it would be worth today if never sold -- from the
// same price (the 2026-11-17 9:30 AM open) the real FY27 pick was priced from, stored on each
// FY26 pick as fy27OpenPrice, so it's a true apples-to-apples window with the
// switched comparison. For a same-ticker pick, "held" and "switched" are the
// same continuous position, so reuse FY27's own since/openingPrice basis --
// an exact 0% swing regardless of data availability. A pick caught in a FY26
// corporate action is valued through its successor ticker / payout, the same
// way FY26 itself valued it.
function diamondHandsRows(rows, quotes) {
  return year3.people.map((p) => {
    const fy27 = rows.find((r) => canonicalName(r.name) === canonicalName(p.name))
    const switched = fy27?.since ?? null
    const sameTicker = fy27 != null && p.ticker === fy27.ticker
    let held
    if (sameTicker) {
      held = switched
    } else {
      const opening = p.fy27OpenPrice ?? p.checkpointPrices?.at(-1)
      const live = corporateActionValue(p.corporateAction, quotes) ?? quotes?.[p.ticker]?.price
      held = opening != null && live != null ? (live - opening) / opening : null
    }
    const diff = held != null && switched != null ? held - switched : null
    return { name: p.name, ticker: p.ticker, held, newTicker: fy27?.ticker, switched, diff }
  })
}

function DiamondHands({ rows, quotes }) {
  const dhRows = useMemo(() => diamondHandsRows(rows, quotes), [rows, quotes])
  // Swing = switched - held (positive when the FY27 switch was the right call).
  // Sorting by this descending groups every "Switching worked!" row first
  // (best switch first), then every "Should've held!" row, ending on the worst.
  const swing = (r) => (r.diff != null ? -r.diff : -Infinity)
  const sorted = [...dhRows].sort((a, b) => swing(b) - swing(a))
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>FY27 pick</th>
              <th>FY26 pick</th>
              <th>Verdict</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const sameTicker = r.diff != null && r.newTicker === r.ticker
              return (
                <tr key={r.name}>
                  <td className="num" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ paddingRight: 4 }}>{r.newTicker ? <span className="ticker">{r.newTicker}</span> : '—'}</td>
                  <td style={{ paddingLeft: 4 }}><span className="ticker">{r.ticker}</span></td>
                  <td className={r.diff == null ? '' : sameTicker ? 'warn' : r.diff < 0 ? 'pos' : 'neg'}>
                    {r.diff == null
                      ? r.newTicker
                        ? '—'
                        : 'no FY27 pick'
                      : sameTicker
                        ? 'Held the pick.'
                        : r.diff < 0
                          ? 'Switching worked!'
                          : 'Should’ve held!'}
                  </td>
                  <td className="details">
                    {r.diff == null
                      ? r.newTicker
                        ? '—'
                        : 'no FY27 pick'
                      : sameTicker
                        ? `Kept ${r.ticker} for FY27, net swing of ${fmtPct(-r.diff, 0)}.`
                        : `Switching from ${r.ticker} (FY26) to ${r.newTicker} (FY27) was a net swing of ${fmtPct(-r.diff, 0)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Showdowns({ rows, showdownLabels }) {
  // Original FY24 roster (35 people) vs. everyone added since, in FY25 or
  // later -- cross-season via the same canonicalName aliasing
  // used for Hold or Switch, not a cohort from cohort_membership.json.
  const veteranNames = new Set(year1.people.map((p) => canonicalName(p.name)))

  return (
    <div className="showdown-grid">
      {SHOWDOWNS.map((s) => {
        if (s.title === 'My Wife vs. Everyone') {
          return (
            <div key={s.title} className="card chart-card">
              <div className="chart-head">
                <h3 className="chart-title">{s.title}</h3>
              </div>
              <div className="showdown-empty">
                DATA NOT AVAILABLE, CHECK PREVIOUS YEARS FOR EVIDENCE OF WIFE'S SUPERIORITY.
              </div>
            </div>
          )
        }
        if (s.title === 'Veterans vs. Newcomers') {
          const veterans = rows.filter((r) => veteranNames.has(canonicalName(r.name)))
          const newcomers = rows.filter((r) => !veteranNames.has(canonicalName(r.name)))
          const chartSeries = [
            { name: 'Veterans', color: SLOT_COLORS[0], values: averageOf(veterans.map((r) => series(r, r.live))) },
            { name: 'Newcomers', color: SLOT_COLORS[1], values: averageOf(newcomers.map((r) => series(r, r.live))) },
          ]
          return (
            <div key={s.title} className="card chart-card">
              <div className="chart-head">
                <h3 className="chart-title">{s.title}</h3>
              </div>
              <Legend series={chartSeries} />
              <LineChart series={chartSeries} xLabels={showdownLabels} height={220} />
            </div>
          )
        }
        const seriesFor = (cohortNames) => {
          const members = rows.filter((r) => cohortNames.includes(canonicalName(r.name)))
          return averageOf(members.map((r) => series(r, r.live)))
        }
        const chartSeries = s.keys
          .map((k, i) => ({ name: s.rename?.[k] || k, color: SLOT_COLORS[i], values: seriesFor(cohortMembership[k] ?? []) }))
          .filter((line) => line.values.some((v) => v != null))
        if (chartSeries.length <= 1) return null
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
            </div>
            <Legend series={chartSeries} />
            <LineChart series={chartSeries} xLabels={showdownLabels} height={220} />
          </div>
        )
      })}
    </div>
  )
}

export default function FY27() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true))
  }, [])

  const rows = useMemo(() => {
    return year4.people
      .map((p) => {
        const caValue = corporateActionValue(p.corporateAction, data?.quotes)
        const q = data?.quotes[p.ticker]
        const live = caValue ?? q?.price ?? p.openingPrice
        return { ...p, live, since: sinceTracking(p.openingPrice, live) }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  const benchmarks = useMemo(() => {
    return year4.benchmarks.map((b) => {
      const q = data?.quotes[b.ticker]
      const live = q?.price ?? b.openingPrice
      return { ...b, live, since: sinceTracking(b.openingPrice, live) }
    })
  }, [data])

  const pv = useMemo(() => {
    const positions = year4.people.map((p) => positionStats(p, data?.quotes))
    const start = year4.people.length * STAKE
    const total = positions.reduce((sum, p) => sum + p.value, 0)
    const dailyChange = positions.reduce((sum, p) => sum + p.dollarChange, 0)
    return { start, total, dailyChange, totalReturn: (total - start) / start }
  }, [data])

  const tracked = rows.filter((r) => r.since != null)
  const sp = benchmarks.find((b) => b.ticker === 'VOO')
  const brk = benchmarks.find((b) => b.ticker === 'BRK.B')
  const best = tracked[0]
  const worst = tracked[tracked.length - 1]
  const korchSeries = averageOf(rows.map((r) => series(r, r.live)))

  const raceLabels = useMemo(() => {
    const n = (year4.checkpointDates?.length ?? 1) + 1 // +1 for the live "now" point
    const labels = (year4.checkpointDates ?? [year4.seasonOpened]).map((d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    )
    labels.length = n - 1
    labels.push('Now')
    return labels
  }, [])

  // Bare month name, no year -- the showdown cards are too narrow for 11
  // "Oct '25"-style labels to fit without breaking.
  const showdownLabels = useMemo(() => {
    const n = (year4.checkpointDates?.length ?? 1) + 1
    const labels = (year4.checkpointDates ?? [year4.seasonOpened]).map((d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short' })
    )
    labels.length = n - 1
    labels.push('Now')
    return labels
  }, [])

  return (
    <>
      <section className="section">
        <h2 className="section-title">FY27: Topline stats</h2>
        {data?.updated && (
          <p className="updated" style={{ margin: '0 0 12px' }}>
            Last refreshed: {refreshedLabel(data.updated)}
          </p>
        )}
        <div className="kpi-row wrap-labels">
          <div className="tile hero">
            <div className="label">KORCH · Total</div>
            <div className={`value ${pv.totalReturn >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(pv.total)}</div>
          </div>
          <div className="tile hero">
            <div className="label">KORCH · FY27</div>
            <div className={`value ${korchSeries.at(-1) >= 0 ? 'pos' : 'neg'}`}>
              {korchSeries.at(-1) != null ? fmtPct(korchSeries.at(-1)) : '—'}
            </div>
          </div>
          <div className="tile">
            <div className="label">
              {data?.updated
                ? `${new Date(data.updated).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })} · Daily Change`
                : 'Daily Change'}
            </div>
            <div className={`value ${pv.dailyChange >= 0 ? 'pos' : 'neg'}`}>
              {pv.dailyChange >= 0 ? '+' : '-'}
              {`$${Math.round(Math.abs(pv.dailyChange)).toLocaleString('en-US')}`}
            </div>
          </div>
          <div className="tile callout">
            <div className="label">Biggest winner</div>
            <div className="value pos">
              {best ? fmtPct(best.since) : '—'}
            </div>
            <div className="note big pos">{best ? best.ticker : 'check back tomorrow'}</div>
          </div>
          <div className="tile callout">
            <div className="label">Biggest loser</div>
            <div className="value neg">
              {worst ? fmtPct(worst.since) : '—'}
            </div>
            <div className="note big neg">{worst ? worst.ticker : 'check back tomorrow'}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">How KORCH works</h2>
        <HowKorchWorks count={year4.people.length} />
      </section>

      <section className="section">
        <h2 className="section-title">KORCH vs. The Market</h2>
        <RaceChart
          series={[
            { name: 'KORCH', color: 'var(--s1)', values: korchSeries, emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: sp ? series(sp, sp.live) : [] },
            { name: 'W. Buffett', color: 'var(--baseline)', values: brk ? series(brk, brk.live) : [] },
          ]}
          xLabels={raceLabels}
        />
        <HeadToHead korchReturn={korchSeries.at(-1) ?? null} spReturn={sp?.since ?? null} buffettReturn={brk?.since ?? null} />
      </section>

      <LogoStrip eyebrow="KORCH is Powered By But Definitely Not Sponsored By" logos={NOT_SPONSORED_LOGOS} />

      <StockSpotlight />

      <section className="section">
        <h2 className="section-title">KORCH: The Stock Picks</h2>
        <RosterTable
          rows={rows.map((r) => ({ ...r, displayTicker: displayTicker(r), latest: r.live }))}
          sinceLabel="FY27"
          errNote={err ? 'Live prices haven’t published yet today — showing each pick’s opening price.' : null}
        />
      </section>

      <LogoStrip eyebrow="KORCH is Inspired By But Absolutely Not Endorsed By" logos={NOT_ENDORSED_LOGOS} />

      <section className="section">
        <h2 className="section-title">Quarterly winners and losers</h2>
        <QuarterChips rows={rows} />
      </section>

      <section className="section">
        <h2 className="section-title">The Showdowns</h2>
        <Showdowns rows={rows} showdownLabels={showdownLabels} />
      </section>

      <LogoStrip eyebrow="KORCH is Fueled By But For Sure Not Supported By" logos={NOT_SUPPORTED_LOGOS} />

      <section className="section">
        <h2 className="section-title">Hold or Switch?</h2>
        <DiamondHands rows={rows} quotes={data?.quotes} />
      </section>
    </>
  )
}
