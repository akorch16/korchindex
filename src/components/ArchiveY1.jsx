import LineChart, { RaceChart, Legend, fmtPct, fmtMoney } from './LineChart'
import year1 from '../data/year1.json'
import cohortMembership from '../data/cohort_membership.json'
import HeadToHead from './HeadToHead'
import HowKorchWorks from './HowKorchWorks'
import RosterTable from './RosterTable'

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
  { title: 'Scott’s vs. Alex’s', keys: ['Scott', 'Alex'] },
  {
    title: 'Santa Barbara High vs. UCLA',
    keys: ['Santa Barbara High Grad', 'Wife of SBHS', 'UCLA Grad', 'Wife of UCLA Grad'],
    rename: { 'Santa Barbara High Grad': 'SBHS Grad', 'Wife of SBHS': 'Wife of SBHS', 'UCLA Grad': 'UCLA Grad', 'Wife of UCLA Grad': 'Wife of UCLA' },
  },
  { title: 'Birth year', keys: ['Gen Z', 'Millennials', 'Gen X', 'Boomers'] },
  { title: 'Men vs. Women', keys: ['Men', 'Women'] },
  { title: 'Uncles vs. Aunts vs. Cousins', keys: ['Uncles', 'Aunts', 'Cousins'] },
  { title: 'Country of birth', keys: ['Americans', 'Canadians', 'Mexicans', 'English'] },
  { title: 'My Wife vs. Everyone', keys: ['Wife'] },
]
const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

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
        if (s.title === 'My Wife vs. Everyone') {
          series.push({
            name: 'Everyone else',
            color: 'var(--baseline)',
            values: averageMonthlySeries(year1.people),
            dash: true,
          })
        }
        if (series.length <= 1) return null
        return (
          <div key={s.title} className="card chart-card">
            <div className="chart-head">
              <h3 className="chart-title">{s.title}</h3>
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
  const voo = year1.benchmarks.find((b) => b.ticker === 'VOO')
  const brk = year1.benchmarks.find((b) => b.ticker === 'BRK.B')
  const quotes = year1.people.filter((p) => p.rationale)
  const best = [...year1.people].sort((a, b) => (b.return ?? -9) - (a.return ?? -9))[0]
  const worst = [...year1.people].sort((a, b) => (a.return ?? 9) - (b.return ?? 9))[0]
  const korchSeries = averageMonthlySeries(year1.people)
  const brkSeries = monthlySeries(brk.monthlyPrices)
  const startValue = year1.people.length * 1000
  const endValue = startValue * (1 + year1.korchReturn)

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
            <div className="label">KORCH · Total</div>
            <div className={`value ${endValue >= startValue ? 'pos' : 'neg'}`}>{fmtMoney(endValue)}</div>
          </div>
          <div className="tile hero">
            <div className="label">KORCH · FY24</div>
            <div className="value pos">{fmtPct(year1.korchReturn)}</div>
          </div>
          <div className="tile callout">
            <div className="label">Biggest winner</div>
            <div className="value pos">{fmtPct(best.return, 0)}</div>
            <div className="note big pos">{best.ticker}</div>
          </div>
          <div className="tile callout">
            <div className="label">Biggest loser</div>
            <div className="value neg">{fmtPct(worst.return, 0)}</div>
            <div className="note big neg">{worst.ticker}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">How KORCH works</h2>
        <HowKorchWorks count={year1.people.length} />
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return, Oct 5 2023 → Oct 7 2024 — the season that started it all."
          series={[
            { name: 'KORCH', color: 'var(--s1)', values: korchSeries, emphasis: true },
            { name: 'S&P 500', color: 'var(--muted)', values: monthlySeries(voo.monthlyPrices) },
            { name: 'W. Buffett', color: 'var(--baseline)', values: brkSeries },
          ]}
          xLabels={monthLabels(year1.monthlyDates)}
        />
        <HeadToHead korchReturn={year1.korchReturn} spReturn={voo.return} buffettReturn={brk.return} />
      </section>

      <section className="section">
        <h2 className="section-title">The leaderboard</h2>
        <RosterTable
          rows={year1.people.map((p) => ({ name: p.name, ticker: p.ticker, since: p.return, openingPrice: p.prices?.[0], latest: p.prices?.at(-1) }))}
          sinceLabel="FY24"
        />
      </section>

      <section className="section">
        <h2 className="section-title">The Showdowns</h2>
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
