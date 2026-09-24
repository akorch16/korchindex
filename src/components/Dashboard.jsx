import { useEffect, useMemo, useState } from 'react'
import LineChart, { RaceChart, Legend, fmtPct, fmtMoney } from './LineChart'
import year2 from '../data/year2.json'
import year1 from '../data/year1.json'
import groups from '../data/groups.json'
import HeadToHead from './HeadToHead'
import HowKorchWorks from './HowKorchWorks'
import RosterTable from './RosterTable'

const START_VALUE = 41000

const monthLabels = (dates) =>
  (dates ?? []).map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))

// Cumulative change at each monthly checkpoint, relative to the opening price.
function monthlySeries(prices) {
  const open = prices?.[0]
  return (prices ?? []).map((v) => (open != null && v != null ? (v - open) / open : null))
}

// Average several people's monthly series index-by-index, ignoring gaps.
function averageMonthlySeries(people) {
  const len = Math.max(0, ...people.map((p) => p.monthlyPrices?.length ?? 0))
  return Array.from({ length: len }, (_, i) => {
    const vals = people.map((p) => monthlySeries(p.monthlyPrices)[i]).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })
}

function Tile({ label, value, note, cls, hero, callout }) {
  return (
    <div className={`tile${hero ? ' hero' : ''}${callout ? ' callout' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value ${cls || ''}`}>{value}</div>
      {note && <div className={`note${callout ? ` big ${cls || ''}` : ''}`}>{note}</div>}
    </div>
  )
}

// FY24 names recorded differently than the canonical spelling FY25's own
// roster uses (same alias table ArchiveY1.jsx uses for cohort matching --
// year2.people already use these canonical spellings directly).
const NAME_ALIASES = {
  'Alex Armstrong': 'Alexander Armstrong',
  'Brit': 'Brittany Buckley',
  'Buckley': 'Scott Buckley',
  'Chris Morris': 'Christopher Morris',
  'Jamie': 'Jamie Armstrong',
  'Karen Korchinski': 'Karin Korchinski',
  'Leala': 'Leala Wong',
  'Michelle Fried': 'Michelle Sullivan',
  'Natalie Tran': 'Natalie Lee',
  'Suzanne Korchinski': 'Suzy Walker',
  'Theo Lee': 'Theodore Lee',
  'Tim': 'Tim Morris',
}
const canonicalName = (name) => NAME_ALIASES[name] ?? name

const since = (open, live) => (open != null && live != null ? (live - open) / open : null)

// Same "held vs. switched" comparison FY26 does for FY25->FY26, one season
// earlier: for each FY24 pick, what it'd be worth today if never sold
// (baseline: FY24's own last known price, since FY24 has no dedicated
// FY25-open backfill) against that same person's real FY25 pick, both
// live-tracked to today via /live/prices.json.
function diamondHandsRowsFY25(quotes) {
  return year1.people.map((p) => {
    const fy25 = year2.people.find((r) => canonicalName(r.name) === canonicalName(p.name))
    const switched = fy25 ? since(fy25.prices?.[0], quotes?.[fy25.ticker]?.price) : null
    const sameTicker = fy25 != null && p.ticker === fy25.ticker
    let held
    if (sameTicker) {
      held = switched
    } else {
      const opening = p.monthlyPrices?.at(-1) ?? p.prices?.at(-1)
      const live = quotes?.[p.ticker]?.price
      held = since(opening, live)
    }
    const diff = held != null && switched != null ? held - switched : null
    return { name: p.name, ticker: p.ticker, held, newTicker: fy25?.ticker, switched, diff }
  })
}

function HoldOrSwitch({ quotes }) {
  const dhRows = useMemo(() => diamondHandsRowsFY25(quotes), [quotes])
  const swing = (r) => (r.diff != null ? -r.diff : -Infinity)
  const sorted = [...dhRows].sort((a, b) => swing(b) - swing(a))
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>FY25 pick</th>
              <th>FY24 pick</th>
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
                        : 'no FY25 pick'
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
                        : 'no FY25 pick'
                      : sameTicker
                        ? `Kept ${r.ticker} for FY25, net swing of ${fmtPct(-r.diff, 0)}.`
                        : `Switching from ${r.ticker} (FY24) to ${r.newTicker} (FY25) was a net swing of ${fmtPct(-r.diff, 0)}`}
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

const SHOWDOWNS = [
  {
    title: 'Scott’s vs. Alex’s',
    keys: ['Scott', 'Alex'],
  },
  {
    title: 'Santa Barbara High vs. UCLA',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  {
    title: 'Birth year',
    keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers'],
  },
  {
    title: 'Men vs. Women',
    keys: ['Men', 'Women'],
  },
  {
    title: 'Uncles vs. Aunts vs. Cousins',
    keys: ['Uncles', 'Aunts', 'Cousins'],
  },
  {
    title: 'Country of birth',
    keys: ['Americans', 'Canadians', 'Mexicans', 'English'],
  },
  {
    title: 'My Wife vs. everyone',
    keys: ['Wife'],
  },
]

const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

function Showdowns() {
  return (
    <div className="showdown-grid">
      {SHOWDOWNS.map((s) => {
        const series = s.keys
          .filter((k) => groups[k])
          .map((k, i) => ({
            name: s.rename?.[k] || k,
            color: SLOT_COLORS[i],
            values: groups[k],
          }))
        if (s.title === 'My Wife vs. everyone') {
          series.push({ name: 'Everyone else', color: 'var(--baseline)', values: groups['Everyone'], dash: true })
        }
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
            </div>
            <Legend series={series} />
            <LineChart series={series} xLabels={['Oct', 'Jan', 'Apr', 'Jul', 'Oct']} height={220} />
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => {})
  }, [])

  const korch = year2.korchReturn
  const sp = year2.benchmarks.find((b) => b.ticker === 'VOO')?.return
  const brk = year2.benchmarks.find((b) => b.ticker === 'BRK.B')?.return
  const endValue = START_VALUE * (1 + korch)
  const best = [...year2.people].sort((a, b) => (b.return ?? -9) - (a.return ?? -9))[0]
  const worst = [...year2.people].sort((a, b) => (a.return ?? 9) - (b.return ?? 9))[0]
  const korchSeries = averageMonthlySeries(year2.people)
  const brkSeries = monthlySeries(year2.benchmarks.find((b) => b.ticker === 'BRK.B')?.monthlyPrices)

  return (
    <>
      <section className="section">
        <h2 className="section-title">FY25: Topline stats</h2>
        <div className="kpi-row">
          <Tile hero label="KORCH · Total" value={fmtMoney(endValue)} cls="pos" />
          <Tile hero label="KORCH · FY25" value={fmtPct(korch)} cls="pos" />
          <Tile label="Biggest winner" value={fmtPct(best.return, 0)} cls="pos" callout note={best.ticker} />
          <Tile label="Biggest loser" value={fmtPct(worst.return, 0)} cls="neg" callout note={worst.ticker} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">How KORCH works</h2>
        <HowKorchWorks count={year2.people.length} />
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return, Oct 10 2024 → Oct 10 2025. Read ’em and weep, Warren B."
          series={[
            { name: 'KORCH', color: 'var(--s1)', values: korchSeries, emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: monthlySeries(year2.benchmarks.find((b) => b.ticker === 'VOO')?.monthlyPrices) },
            { name: 'W. Buffett', color: 'var(--baseline)', values: brkSeries },
          ]}
          xLabels={monthLabels(year2.monthlyDates)}
        />
        <HeadToHead korchReturn={korch} spReturn={sp} buffettReturn={brk} />
      </section>

      <section className="section">
        <h2 className="section-title">The leaderboard</h2>
        <RosterTable
          rows={year2.people.map((p) => ({ name: p.name, ticker: p.ticker, since: p.return, openingPrice: p.prices?.[0], latest: p.prices?.at(-1) }))}
          sinceLabel="FY25"
        />
      </section>

      <section className="section">
        <h2 className="section-title">The Showdowns</h2>
        <p className="section-sub">
          Sweeping conclusions drawn very loosely from facts and data. Group lines are the average
          cumulative return of each cohort.
        </p>
        <Showdowns />
      </section>

      <section className="section">
        <h2 className="section-title">Hold or Switch?</h2>
        <HoldOrSwitch quotes={data?.quotes} />
      </section>
    </>
  )
}
