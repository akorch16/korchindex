import { Leaderboard } from './Dashboard'
import { RaceChart, fmtPct } from './LineChart'
import year1 from '../data/year1.json'

function toRow(p) {
  const [open, q1, q2, q3] = p.prices
  const c = (v) => (open != null && v != null ? (v - open) / open : null)
  return { name: p.name, ticker: p.ticker, changes: [c(q1), c(q2), c(q3)], return: p.return }
}

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
          <div className="tile callout">
            <div className="label">Best pick</div>
            <div className="value pos">{fmtPct(best.return, 0)}</div>
            <div className="note">{best.ticker}</div>
          </div>
          <div className="tile callout">
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
            { name: 'KORCH', color: 'var(--s1)', values: averageMonthlySeries(year1.people), emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: monthlySeries(voo.monthlyPrices) },
            { name: 'W. Buffett', color: 'var(--baseline)', values: monthlySeries(brk.monthlyPrices) },
          ]}
          xLabels={monthLabels(year1.monthlyDates)}
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
