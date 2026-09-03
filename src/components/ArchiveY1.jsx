import { Leaderboard } from './Dashboard'
import LineChart, { RaceChart, Legend, fmtPct } from './LineChart'
import year1 from '../data/year1.json'
import cohortMembership from '../data/cohort_membership.json'

// Names recorded differently across seasons than in the FY25 spreadsheet
// (the source of cohortMembership) -- resolved by cross-season corroboration
// (see backend/scripts/derived/cohort_memberships.json history). Two are
// lower-confidence: Michelle Fried/Sullivan (plausible maiden->married name)
// and Suzanne Korchinski/Suzy Walker (corroborated via family role: she's
// marked "Wife" here and shares Jim Korchinski's surname, and Jim is a
// confirmed "Uncle" -- Aunts are specifically the Uncles' wives).
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

const SHOWDOWNS = [
  { title: 'Scott’s vs. Alex’s', sub: 'Same feud, one season earlier.', keys: ['Scott', 'Alex'] },
  {
    title: 'Santa Barbara High vs. UCLA',
    sub: 'Stay in school, but don’t sweat college. Also: listen to your wife.',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  { title: 'Birth year', sub: 'The original generational grudge match.', keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers'] },
  { title: 'Men vs. Women', sub: 'FY24’s edition of the eternal question.', keys: ['Men', 'Women'] },
  { title: 'Uncles vs. Aunts vs. Cousins', sub: 'The family tree, one year younger.', keys: ['Uncles', 'Aunts', 'Cousins'] },
  { title: 'Country of birth', sub: 'Marrying a Mexican: a smart life investment, one year in.', keys: ['Americans', 'Canadians', 'Mexicans', 'English'] },
  { title: 'The Wife vs. everyone', sub: 'One pick, one line, one very confident showing — the FY24 edition.', keys: ['Wife'] },
]
const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

function toRow(p) {
  const [open, q1, q2, q3] = p.prices
  const c = (v) => (open != null && v != null ? (v - open) / open : null)
  return { name: p.name, ticker: p.ticker, changes: [c(q1), c(q2), c(q3)], return: p.return }
}

const monthLabels = (dates) =>
  (dates ?? []).map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))

// Bare month name, no year -- the showdown cards are too narrow for 11
// "Oct '25"-style labels to fit without breaking.
const monthOnlyLabels = (dates) =>
  (dates ?? []).map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short' }))

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

// Average monthly series for the subset of this season's roster whose
// canonical name is in `cohortNames` -- computed from FY24's own price
// data, not FY25's groups.json.
function cohortSeries(cohortNames) {
  const members = year1.people.filter((p) => cohortNames.includes(canonicalName(p.name)))
  return averageMonthlySeries(members)
}

function Showdowns() {
  return (
    <div className="showdown-grid">
      {SHOWDOWNS.map((s) => {
        const series = s.keys
          .map((k, i) => ({ name: s.rename?.[k] || k, color: SLOT_COLORS[i], values: cohortSeries(cohortMembership[k] ?? []) }))
          .filter((line) => line.values.some((v) => v != null))
        series.push({ name: 'Everyone', color: 'var(--baseline)', values: averageMonthlySeries(year1.people), dash: true })
        if (series.length <= 1) return null
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
              <p className="chart-sub">{s.sub}</p>
            </div>
            <Legend series={series} />
            <LineChart series={series} xLabels={monthOnlyLabels(year1.monthlyDates)} height={220} />
          </div>
        )
      })}
    </div>
  )
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
        <h2 className="section-title">The showdowns</h2>
        <p className="section-sub">
          Same demographic cohorts as FY25, computed from FY24’s own picks and prices. Group lines
          are the average cumulative return of each cohort; the dashed line is everyone.
        </p>
        <Showdowns />
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
