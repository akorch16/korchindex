import { useEffect, useMemo, useState } from 'react'
import LineChart, { RaceChart, Legend, fmtPct } from './LineChart'
import year3 from '../data/year3.json'
import year2 from '../data/year2.json'
import cohortMembership from '../data/cohort_membership.json'

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
  'Chris Morris': 'Christopher Morris',
  'Karen Korchinski': 'Karin Korchinski',
  'Michelle Fried': 'Michelle Sullivan',
  'Suzanne Korchinski': 'Suzy Walker',
  'Theo Lee': 'Theodore Lee',
}
const canonicalName = (name) => NAME_ALIASES[name] ?? name

const SHOWDOWNS = [
  { title: 'Scott’s vs. Alex’s', sub: 'The FY26 rematch.', keys: ['Scott', 'Alex'] },
  {
    title: 'Santa Barbara High vs. UCLA',
    sub: 'Stay in school, but don’t sweat college. Also: listen to your wife.',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  { title: 'Birth year', sub: 'The generational grudge match, live.', keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers'] },
  { title: 'Men vs. Women', sub: 'FY26’s edition of the eternal question.', keys: ['Men', 'Women'] },
  { title: 'Uncles vs. Aunts vs. Cousins', sub: 'The family tree, live.', keys: ['Uncles', 'Aunts', 'Cousins'] },
  { title: 'Country of birth', sub: 'Marrying a Mexican: a smart life investment, live.', keys: ['Americans', 'Canadians', 'Mexicans', 'English'] },
  { title: 'The Wife vs. everyone', sub: 'One pick, one line, one very confident showing — live.', keys: ['Wife'] },
]
const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

function sinceTracking(openingPrice, live) {
  return live != null && openingPrice != null ? (live - openingPrice) / openingPrice : null
}

// A pick caught in a corporate action mid-season no longer has a live quote
// under its original ticker -- derive an equivalent per-original-share value
// instead: a liquidation's frozen cash payout, or a merger/rebrand's cash-plus-
// successor-shares conversion (ratio 1 with no cash covers a plain rebrand).
function corporateActionValue(ca, quotes) {
  if (!ca) return null
  if (ca.payout != null) return ca.payout
  if (ca.successorTicker) {
    const successorPrice = quotes?.[ca.successorTicker]?.price
    if (successorPrice == null) return null
    return (ca.cashPerShare ?? 0) + (ca.shareRatio ?? 1) * successorPrice
  }
  return null
}

function displayTicker(p) {
  const ca = p.corporateAction
  if (!ca) return p.ticker
  return ca.successorTicker ? `${p.ticker} (${ca.successorTicker})` : `${p.ticker} (liquidated)`
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
// quarter window specifically (not cumulative since the FY26 open), using
// the checkpointPrices indices for Oct 28 / Jan 28 / Apr 28 / Jul 28 --
// Q4 (Jul 28 -> now) uses the live price for its still-open end point.
const QUARTER_WINDOWS = [
  { label: 'Q1', sub: 'Oct 28 → Jan 28', startIdx: 0, endIdx: 3 },
  { label: 'Q2', sub: 'Jan 28 → Apr 28', startIdx: 3, endIdx: 6 },
  { label: 'Q3', sub: 'Apr 28 → Jul 28', startIdx: 6, endIdx: 9 },
  { label: 'Q4', sub: 'Jul 28 → now', startIdx: 9, endIdx: null },
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

// For every FY25 pick, what it would be worth today if never sold (since
// FY25's own Oct 2024 open, using today's live quote) versus what that same
// person actually did instead this season -- their real FY26 pick's return
// since the FY26 open. Two different time windows by nature (holding one
// pick two seasons vs. a fresh pick this season), shown side by side.
function diamondHandsRows(rows, quotes) {
  return year2.people.map((p) => {
    const opening = p.prices?.[0]
    const live = quotes?.[p.ticker]?.price
    const held = opening != null && live != null ? (live - opening) / opening : null
    const fy26 = rows.find((r) => canonicalName(r.name) === canonicalName(p.name))
    return { name: p.name, ticker: p.ticker, held, newTicker: fy26?.ticker, switched: fy26?.since ?? null }
  })
}

function DiamondHands({ rows, quotes }) {
  const dhRows = useMemo(() => diamondHandsRows(rows, quotes), [rows, quotes])
  const sorted = [...dhRows].sort((a, b) => (b.held ?? -Infinity) - (a.held ?? -Infinity))
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>FY26 pick</th>
              <th className="num">Since FY26 open</th>
              <th>FY25 pick</th>
              <th className="num">Held since FY25 open</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const diff = r.held != null && r.switched != null ? r.held - r.switched : null
              return (
                <tr key={r.name}>
                  <td className="num" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td>{r.newTicker ? <span className="ticker">{r.newTicker}</span> : '—'}</td>
                  <td className={`num ${r.switched == null ? '' : r.switched >= 0 ? 'pos' : 'neg'}`}>
                    {r.switched == null ? '—' : fmtPct(r.switched)}
                  </td>
                  <td><span className="ticker">{r.ticker}</span></td>
                  <td className={`num ${r.held == null ? '' : r.held >= 0 ? 'pos' : 'neg'}`}>
                    {r.held == null ? '—' : fmtPct(r.held)}
                  </td>
                  <td className={diff == null ? '' : diff >= 0 ? 'pos' : 'neg'}>
                    {diff == null
                      ? (r.newTicker ? '—' : 'no FY26 pick')
                      : diff >= 0
                        ? `Held would’ve won by ${fmtPct(Math.abs(diff), 0)}`
                        : `Switching won by ${fmtPct(Math.abs(diff), 0)}`}
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
  return (
    <div className="showdown-grid">
      {SHOWDOWNS.map((s) => {
        const seriesFor = (cohortNames) => {
          const members = rows.filter((r) => cohortNames.includes(canonicalName(r.name)))
          return averageOf(members.map((r) => series(r, r.live)))
        }
        const chartSeries = s.keys
          .map((k, i) => ({ name: s.rename?.[k] || k, color: SLOT_COLORS[i], values: seriesFor(cohortMembership[k] ?? []) }))
          .filter((line) => line.values.some((v) => v != null))
        chartSeries.push({ name: 'KORCH', color: 'var(--baseline)', values: averageOf(rows.map((r) => series(r, r.live))), dash: true })
        if (chartSeries.length <= 1) return null
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
              <p className="chart-sub">{s.sub}</p>
            </div>
            <Legend series={chartSeries} />
            <LineChart series={chartSeries} xLabels={showdownLabels} height={220} />
          </div>
        )
      })}
    </div>
  )
}

export default function FY26() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true))
  }, [])

  const rows = useMemo(() => {
    return year3.people
      .map((p) => {
        const caValue = corporateActionValue(p.corporateAction, data?.quotes)
        const q = data?.quotes[p.ticker]
        const live = caValue ?? q?.price ?? p.openingPrice
        return { ...p, live, since: sinceTracking(p.openingPrice, live) }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  const benchmarks = useMemo(() => {
    return year3.benchmarks.map((b) => {
      const q = data?.quotes[b.ticker]
      const live = q?.price ?? b.openingPrice
      return { ...b, live, since: sinceTracking(b.openingPrice, live) }
    })
  }, [data])

  const tracked = rows.filter((r) => r.since != null)
  const korch = tracked.length ? tracked.reduce((sum, r) => sum + r.since, 0) / tracked.length : null
  const sp = benchmarks.find((b) => b.ticker === 'VOO')
  const brk = benchmarks.find((b) => b.ticker === 'BRK.B')
  const best = tracked[0]
  const worst = tracked[tracked.length - 1]

  const raceLabels = useMemo(() => {
    const n = (year3.checkpointDates?.length ?? 1) + 1 // +1 for the live "now" point
    const labels = (year3.checkpointDates ?? [year3.seasonOpened]).map((d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    )
    labels.length = n - 1
    labels.push('Now')
    return labels
  }, [])

  // Bare month name, no year -- the showdown cards are too narrow for 11
  // "Oct '25"-style labels to fit without breaking.
  const showdownLabels = useMemo(() => {
    const n = (year3.checkpointDates?.length ?? 1) + 1
    const labels = (year3.checkpointDates ?? [year3.seasonOpened]).map((d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short' })
    )
    labels.length = n - 1
    labels.push('Now')
    return labels
  }, [])

  return (
    <>
      <section className="section">
        <h2 className="section-title">FY26: Topline stats</h2>
        <div className="kpi-row">
          <div className="tile hero">
            <div className="label">KORCH · FY26</div>
            <div className={`value ${korch != null && korch >= 0 ? 'pos' : korch != null ? 'neg' : ''}`}>
              {korch != null ? fmtPct(korch) : '—'}
            </div>
          </div>
          <div className="tile">
            <div className="label">S&P 500</div>
            <div className={`value ${sp?.since != null && sp.since >= 0 ? 'pos' : sp?.since != null ? 'neg' : ''}`}>
              {sp?.since != null ? fmtPct(sp.since) : '—'}
            </div>
          </div>
          <div className="tile">
            <div className="label">Warren Buffett</div>
            <div className={`value ${brk?.since != null && brk.since >= 0 ? 'pos' : brk?.since != null ? 'neg' : ''}`}>
              {brk?.since != null ? fmtPct(brk.since) : '—'}
            </div>
          </div>
          <div className="tile callout">
            <div className="label">Best pick</div>
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
        <RaceChart
          title="KORCH vs. The Market"
          series={[
            {
              name: 'KORCH',
              color: 'var(--s1)',
              values: averageOf(rows.map((r) => series(r, r.live))),
              emphasis: true,
            },
            { name: 'S&P 500', color: 'var(--muted)', values: sp ? series(sp, sp.live) : [] },
            { name: 'W. Buffett', color: 'var(--baseline)', values: brk ? series(brk, brk.live) : [] },
          ]}
          xLabels={raceLabels}
        />
      </section>

      <section className="section">
        <h2 className="section-title">KORCH: The Stock Picks</h2>
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th className="num">Since FY26 open</th>
                  <th className="num">Opening price</th>
                  <th className="num">Latest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td><span className="ticker">{displayTicker(r)}</span></td>
                    <td className={`num ${r.since == null ? '' : r.since >= 0 ? 'pos' : 'neg'}`}>
                      {r.since == null ? 'pending' : fmtPct(r.since)}
                    </td>
                    <td className="num">{r.openingPrice != null ? `$${r.openingPrice.toFixed(2)}` : '—'}</td>
                    <td className="num">{r.live != null ? `$${r.live.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {err && (
          <p className="footnote">
            Live prices haven’t published yet today — showing each pick’s opening price.
          </p>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Quarterly winners and losers</h2>
        <QuarterChips rows={rows} />
      </section>

      <section className="section">
        <h2 className="section-title">The showdowns</h2>
        <Showdowns rows={rows} showdownLabels={showdownLabels} />
      </section>

      <section className="section">
        <h2 className="section-title">Diamond hands</h2>
        <DiamondHands rows={rows} quotes={data?.quotes} />
      </section>
    </>
  )
}
