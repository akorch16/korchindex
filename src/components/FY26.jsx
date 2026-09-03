import { useEffect, useMemo, useState } from 'react'
import LineChart, { RaceChart, Legend, fmtPct } from './LineChart'
import year3 from '../data/year3.json'
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
        chartSeries.push({ name: 'Everyone', color: 'var(--baseline)', values: averageOf(rows.map((r) => series(r, r.live))), dash: true })
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
  const pending = rows.filter((r) => r.openingPrice == null && !r.corporateAction)
  const corporateActions = rows.filter((r) => r.corporateAction)
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
        <h2 className="section-title">FY26 — the picks are in</h2>
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
            <div className="note">{best ? best.ticker : 'check back tomorrow'}</div>
          </div>
          <div className="tile callout">
            <div className="label">Biggest loser</div>
            <div className="value neg">
              {worst ? fmtPct(worst.since) : '—'}
            </div>
            <div className="note">{worst ? worst.ticker : 'check back tomorrow'}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return since the FY26 open — updated live, one quarter at a time."
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
        <p className="footnote">
          “Since FY26 open” compares each price (including the S&P 500 and Warren Buffett benchmarks
          above) against that ticker’s actual close on the season’s October 28, 2025 start —
          backfilled from historical data, the same way FY24 and FY25 are tracked.
          {pending.length > 0 &&
            ` ${pending.map((p) => p.ticker).join(', ')} ${pending.length === 1 ? 'has' : 'have'} no reliable opening price yet (thin trading or a delisting around that date) and show as pending until that resolves.`}
        </p>
        {corporateActions.length > 0 && (
          <p className="footnote">
            Three picks were caught up in corporate actions mid-season: REVG merged into Terex
            (TEX) on Feb 2, 2026 ($8.71 cash + 0.9809 TEX shares per share); FSST was liquidated
            by Fidelity on Nov 13, 2025 (cash payout $30.8963/share); BITF completed a US
            redomiciliation and rebranded 1:1 to Keel Infrastructure Corp (KEEL) on Apr 6, 2026.
            Each “Latest” value above reflects the real successor price or payout, tracked against
            their actual October 28, 2025 opening prices like every other pick.
          </p>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">The showdowns</h2>
        <p className="section-sub">
          Same demographic cohorts as FY25 and FY24, computed from FY26’s own picks and live
          prices. Group lines are the average cumulative return of each cohort; the dashed line is
          everyone.
        </p>
        <Showdowns rows={rows} showdownLabels={showdownLabels} />
      </section>
    </>
  )
}
