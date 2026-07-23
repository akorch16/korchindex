import { Leaderboard } from './Dashboard'
import { RaceChart, fmtPct } from './LineChart'
import year1 from '../data/year1.json'

const Q_LABELS = ['Oct ’23', 'Jan ’24', 'Apr ’24', 'Jul ’24', 'Oct ’24']

function toRow(p) {
  const [open, q1, q2, q3] = p.prices
  const c = (v) => (open != null && v != null ? (v - open) / open : null)
  return { name: p.name, ticker: p.ticker, changes: [c(q1), c(q2), c(q3)], return: p.return }
}

// Quarterly change relative to the opening price, for checkpoint index i (1-3).
function checkpointChange(prices, i) {
  const [open] = prices
  return open != null && prices[i] != null ? (prices[i] - open) / open : null
}

// [0, avgQ1, avgQ2, avgQ3, avgFinal] across a roster — the KORCH average line.
function averageSeries(people) {
  const avgAt = (fn) => {
    const vals = people.map(fn).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return [
    0,
    avgAt((p) => checkpointChange(p.prices, 1)),
    avgAt((p) => checkpointChange(p.prices, 2)),
    avgAt((p) => checkpointChange(p.prices, 3)),
    avgAt((p) => p.return),
  ]
}

// A single benchmark's series. FY24's benchmark prices[4] is unset, so the
// final point comes from the separately-given `return` field instead.
function benchmarkSeries(b) {
  return [0, checkpointChange(b.prices, 1), checkpointChange(b.prices, 2), checkpointChange(b.prices, 3), b.return]
}

export default function ArchiveY1() {
  const people = year1.people.map(toRow)
  const voo = year1.benchmarks.find((b) => b.ticker === 'VOO')
  const brk = year1.benchmarks.find((b) => b.ticker === 'BRK.B')
  const quotes = year1.people.filter((p) => p.rationale)
  const best = [...year1.people].sort((a, b) => (b.return ?? -9) - (a.return ?? -9))[0]
  const worst = [...year1.people].sort((a, b) => (a.return ?? 9) - (b.return ?? 9))[0]

  return (
    <>
      <section className="section">
        <h2 className="section-title">Year 1 — FY24 archive</h2>
        <p className="section-sub">
          The season that started it all: October 5, 2023 → October 7, 2024. Thirty-five picks,
          one very early bet on Microstrategy, and the birth of a financial institution.
        </p>
        <div className="kpi-row">
          <div className="tile hero">
            <div className="label">Average pick · FY24</div>
            <div className="value pos">{fmtPct(year1.korchReturn)}</div>
            <div className="note">Equal-weight average of all 35 picks</div>
          </div>
          <div className="tile">
            <div className="label">S&P 500</div>
            <div className="value">{fmtPct(voo.return)}</div>
            <div className="note">VOO, same window</div>
          </div>
          <div className="tile">
            <div className="label">Warren Buffett</div>
            <div className="value">{fmtPct(brk.return)}</div>
            <div className="note">BRK.B, same window</div>
          </div>
          <div className="tile">
            <div className="label">Best pick</div>
            <div className="value pos">{fmtPct(best.return, 0)}</div>
            <div className="note">{best.ticker}</div>
          </div>
          <div className="tile">
            <div className="label">Biggest loser</div>
            <div className="value neg">{fmtPct(worst.return, 0)}</div>
            <div className="note">{worst.ticker}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return, Oct 5 2023 → Oct 7 2024 — the season that started it all."
          series={[
            { name: 'KORCH', color: 'var(--s1)', values: averageSeries(year1.people), emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: benchmarkSeries(voo) },
            { name: 'W. Buffett', color: 'var(--baseline)', values: benchmarkSeries(brk) },
          ]}
          xLabels={Q_LABELS}
        />
      </section>

      <section className="section">
        <Leaderboard
          people={people}
          title="FY24 leaderboard"
          sub="Quarter columns are cumulative from the October 2023 open (Jan / Apr / Jul checkpoints)."
        />
      </section>

      <section className="section">
        <h2 className="section-title">In their own words</h2>
        <p className="section-sub">Selected pick rationales, preserved verbatim for the historical record.</p>
        <div className="quote-grid">
          {quotes.map((p) => (
            <blockquote key={p.name} className="rationale">
              “{p.rationale.length > 420 ? p.rationale.slice(0, 420) + '…' : p.rationale}”
              <footer>
                — {p.ticker} ({p.return != null ? fmtPct(p.return, 0) : 'n/a'})
              </footer>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  )
}
