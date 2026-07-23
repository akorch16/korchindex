import { useMemo, useState } from 'react'
import LineChart, { RaceChart, Legend, fmtPct } from './LineChart'
import year2 from '../data/year2.json'
import groups from '../data/groups.json'
import hold from '../data/hold.json'

const START_VALUE = 41000

const Q_LABELS = ['Oct ’24', 'Jan ’25', 'Apr ’25', 'Jul ’25', 'Oct ’25']

function Tile({ label, value, note, cls, hero }) {
  return (
    <div className={`tile${hero ? ' hero' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value ${cls || ''}`}>{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  )
}

function quarterExtremes() {
  // Quarter-over-quarter change per pick, matching the newsletter's Q winners/losers
  const out = []
  for (let q = 1; q <= 4; q++) {
    let best = null
    let worst = null
    for (const p of year2.people) {
      const prev = q === 1 ? 0 : p.changes[q - 2]
      const cur = p.changes[q - 1]
      if (prev == null || cur == null) continue
      const qoq = (1 + cur) / (1 + prev) - 1
      if (!best || qoq > best.qoq) best = { ...p, qoq }
      if (!worst || qoq < worst.qoq) worst = { ...p, qoq }
    }
    out.push({ q, best, worst })
  }
  return out
}

function Chips() {
  const qs = useMemo(quarterExtremes, [])
  return (
    <div className="chips">
      {qs.map(({ q, best, worst }) => (
        <div key={q} className="chip">
          <div className="q">Q{q}</div>
          <div className="win">
            <span className="who">▲ {best.ticker} {fmtPct(best.qoq, 0)}</span>
          </div>
          <div className="lose">
            <span className="who">▼ {worst.ticker} {fmtPct(worst.qoq, 0)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReturnBar({ value, min, max }) {
  const span = max - min
  const zero = ((0 - min) / span) * 100
  const end = ((value - min) / span) * 100
  const left = Math.min(zero, end)
  const width = Math.max(Math.abs(end - zero), 0.7)
  return (
    <div className="retbar">
      <div className="track">
        <div className="axis" style={{ left: `${zero}%` }} />
        <div className={`bar ${value >= 0 ? 'gain' : 'loss'}`} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <span className={`pct ${value >= 0 ? 'pos' : 'neg'}`}>{fmtPct(value)}</span>
    </div>
  )
}

const COLS = [
  { key: 'ticker', label: 'Pick' },
  { key: 'q1', label: 'Q1', num: true },
  { key: 'q2', label: 'Q2', num: true },
  { key: 'q3', label: 'Q3', num: true },
  { key: 'return', label: 'Year', num: true },
]

export function Leaderboard({ people, title, sub }) {
  const [sort, setSort] = useState({ key: 'return', dir: -1 })
  const rows = useMemo(() => {
    const get = (p) =>
      sort.key === 'q1' ? p.changes?.[0]
      : sort.key === 'q2' ? p.changes?.[1]
      : sort.key === 'q3' ? p.changes?.[2]
      : p[sort.key]
    return [...people].sort((a, b) => {
      const va = get(a), vb = get(b)
      if (typeof va === 'string') return sort.dir * va.localeCompare(vb)
      return sort.dir * ((va ?? -Infinity) - (vb ?? -Infinity))
    })
  }, [people, sort])

  const returns = people.map((p) => p.return).filter((v) => v != null)
  const min = Math.min(0, ...returns)
  const max = Math.max(0, ...returns)

  const clickSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'ticker' ? 1 : -1 }))

  return (
    <div className="card">
      {title && <h3 className="chart-title" style={{ marginBottom: 12 }}>{title}</h3>}
      {sub && <p className="chart-sub" style={{ margin: '-8px 0 12px' }}>{sub}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`sortable${c.num ? ' num' : ''}`}
                  onClick={() => clickSort(c.key)}
                >
                  {c.label}{sort.key === c.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.name ?? p.ticker + i}>
                <td className="num" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td><span className="ticker">{p.ticker}</span></td>
                {[0, 1, 2].map((qi) => {
                  const v = p.changes?.[qi]
                  return (
                    <td key={qi} className={`num ${v == null ? '' : v >= 0 ? 'pos' : 'neg'}`}>
                      {v == null ? '—' : fmtPct(v, 0)}
                    </td>
                  )
                })}
                <td>{p.return == null ? '—' : <ReturnBar value={p.return} min={min} max={max} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SHOWDOWNS = [
  {
    title: 'Scott’s vs. Alex’s',
    sub: 'Alexes start strong but can’t keep the pace. Scotts accelerate to the finish. Statistically inconclusive.',
    keys: ['Scott', 'Alex'],
  },
  {
    title: 'Santa Barbara High vs. UCLA',
    sub: 'Stay in school, but don’t sweat college. Also: listen to your wife.',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  {
    title: 'Birth year',
    sub: 'Boomers hold the majority of U.S. wealth, and the same bears true in KORCH. OK Boomers. We see you.',
    keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers'],
  },
  {
    title: 'Men vs. Women',
    sub: 'There are conclusions one could draw from this graph. We won’t be the ones to put them in writing.',
    keys: ['Men', 'Women'],
  },
  {
    title: 'Uncles vs. Aunts vs. Cousins',
    sub: 'Surely this won’t provoke any inter-family rivalries.',
    keys: ['Uncles', 'Aunts', 'Cousins'],
  },
  {
    title: 'Country of birth',
    sub: 'Marrying a Mexican: a smart life investment and a smart financial investment.',
    keys: ['Americans', 'Canadians', 'Mexicans', 'English'],
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
        series.push({ name: 'Everyone', color: 'var(--baseline)', values: groups['Everyone'], dash: true })
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
              <p className="chart-sub">{s.sub}</p>
            </div>
            <Legend series={series} />
            <LineChart series={series} xLabels={['Oct', 'Jan', 'Apr', 'Jul', 'Oct']} height={220} />
          </div>
        )
      })}
    </div>
  )
}

function DiamondHands() {
  const rows = [...hold].sort((a, b) => b.change - a.change).slice(0, 10)
  const max = Math.max(...rows.map((r) => r.change))
  const min = Math.min(0, ...rows.map((r) => r.change))
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th className="num">#</th><th>Pick</th><th className="num">Then</th><th className="num">Now</th><th>Since Oct ’23</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={(r.name ?? '') + r.ticker}>
                <td className="num" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td><span className="ticker">{r.ticker}</span></td>
                <td className="num">${r.start.toFixed(2)}</td>
                <td className="num">${r.end.toFixed(2)}</td>
                <td><ReturnBar value={r.change} min={min} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const korch = year2.korchReturn
  const sp = year2.benchmarks.find((b) => b.ticker === 'VOO')?.return
  const brk = year2.benchmarks.find((b) => b.ticker === 'BRK.B')?.return
  const endValue = START_VALUE * (1 + korch)
  const best = [...year2.people].sort((a, b) => (b.return ?? -9) - (a.return ?? -9))[0]
  const worst = [...year2.people].sort((a, b) => (a.return ?? 9) - (b.return ?? 9))[0]

  return (
    <>
      <section className="section">
        <div className="kpi-row">
          <Tile hero label="KORCH · FY25" value={fmtPct(korch)} cls="pos" note={`$${START_VALUE.toLocaleString()} → $${Math.round(endValue).toLocaleString()}`} />
          <Tile label="S&P 500" value={fmtPct(sp)} note="VOO, same window" />
          <Tile label="Warren Buffett" value={fmtPct(brk)} note="BRK.B, same window" />
          <Tile label="Best pick" value={fmtPct(best.return, 0)} cls="pos" note={best.ticker} />
          <Tile label="Biggest loser" value={fmtPct(worst.return, 0)} cls="neg" note={worst.ticker} />
        </div>
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return, Oct 10 2024 → Oct 10 2025. Read ’em and weep, Warren B."
          series={[
            { name: 'KORCH', color: 'var(--s1)', values: groups['KORCH'], emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: groups['S&P 500'] },
            { name: 'W. Buffett', color: 'var(--baseline)', values: groups['Warren Buffett'] },
          ]}
          xLabels={Q_LABELS}
        />
      </section>

      <section className="section">
        <h2 className="section-title">The leaderboard</h2>
        <p className="section-sub">
          One pick per person, ~$1,000 each, Oct 10 → Oct 10. Quarterly winners and losers below are
          quarter-over-quarter moves — the same math the newsletter uses.
        </p>
        <Chips />
        <Leaderboard people={year2.people} />
      </section>

      <section className="section">
        <h2 className="section-title">The showdowns</h2>
        <p className="section-sub">
          Sweeping conclusions drawn very loosely from facts and data. Group lines are the average
          cumulative return of each cohort; the dashed line is everyone.
        </p>
        <Showdowns />
      </section>

      <section className="section">
        <h2 className="section-title">Diamond hands</h2>
        <p className="section-sub">
          What if nobody ever sold? Top Year 1 picks if held from October 2023 all the way through
          October 2025.
        </p>
        <DiamondHands />
      </section>
    </>
  )
}
