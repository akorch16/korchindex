import { Leaderboard } from './Dashboard'
import { fmtPct } from './LineChart'
import year1 from '../data/year1.json'

function toRow(p) {
  const [open, q1, q2, q3] = p.prices
  const c = (v) => (open != null && v != null ? (v - open) / open : null)
  return { name: p.name, ticker: p.ticker, changes: [c(q1), c(q2), c(q3)], return: p.return }
}

export default function ArchiveY1() {
  const people = year1.people.map(toRow)
  const voo = year1.benchmarks.find((b) => b.ticker === 'VOO')
  const brk = year1.benchmarks.find((b) => b.ticker === 'BRK.B')
  const quotes = year1.people.filter((p) => p.rationale)
  const jim = year1.people.find((p) => p.name === 'Jim Korchinski')
  const gap = jim ? jim.return - voo.return : null

  return (
    <>
      {jim && (
        <section className="section">
          <div className="card">
            <h3 className="chart-title" style={{ marginBottom: 4 }}>
              Spotlight: Jim Korchinski vs. the S&P 500
            </h3>
            <p className="chart-sub" style={{ margin: '0 0 16px' }}>
              His FY24 pick, {jim.ticker}, over the full 12-month season ({year1.dates[0]} →{' '}
              {year1.dates[year1.dates.length - 1]}).
            </p>
            <div className="kpi-row">
              <div className="tile">
                <div className="label">Jim Korchinski — {jim.ticker}</div>
                <div className={`value ${jim.return >= 0 ? 'pos' : 'neg'}`}>{fmtPct(jim.return)}</div>
                <div className="note">
                  ${jim.prices[0].toFixed(2)} → ${jim.prices[jim.prices.length - 1].toFixed(2)}
                </div>
              </div>
              <div className="tile">
                <div className="label">S&P 500 (VOO)</div>
                <div className={`value ${voo.return >= 0 ? 'pos' : 'neg'}`}>{fmtPct(voo.return)}</div>
                <div className="note">same 12-month window</div>
              </div>
              <div className="tile">
                <div className="label">Gap to the index</div>
                <div className={`value ${gap >= 0 ? 'pos' : 'neg'}`}>{fmtPct(gap)}</div>
                <div className="note">{gap >= 0 ? 'ahead of' : 'trailed'} the S&P 500</div>
              </div>
            </div>
          </div>
        </section>
      )}

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
            <div className="value pos">{fmtPct(4.754174, 0)}</div>
            <div className="note">MSTR — Alex Armstrong</div>
          </div>
        </div>
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
                — {p.name}, on {p.ticker} ({p.return != null ? fmtPct(p.return, 0) : 'n/a'})
              </footer>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  )
}
