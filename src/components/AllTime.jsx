import { useEffect, useMemo, useState } from 'react'
import { fmtPct } from './LineChart'
import year1 from '../data/year1.json'
import year2 from '../data/year2.json'
import year3 from '../data/year3.json'
import { corporateActionValue, sinceTracking, displayTicker } from './FY26'

// Names recorded differently across the three seasons' rosters -- this is
// FY24's alias table (the superset; FY26's own copy is a subset of it),
// resolving everyone to one canonical name across all three years.
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

// One row per person, merging their pick + return from whichever of the
// three seasons they played (not everyone has played all three -- the
// roster has grown each year). FY24/FY25 returns are the season's final,
// already-settled numbers; FY26 is computed live the same way the FY26 tab
// does, corporate actions included.
function allTimeRows(quotes) {
  const byName = new Map()
  const add = (season, p, ret) => {
    const key = canonicalName(p.name)
    if (!byName.has(key)) byName.set(key, { name: key })
    byName.get(key)[season] = { ticker: displayTicker(p), ret }
  }

  year1.people.forEach((p) => add('fy24', p, p.return))
  year2.people.forEach((p) => add('fy25', p, p.return))
  year3.people.forEach((p) => {
    const caValue = corporateActionValue(p.corporateAction, quotes)
    const q = quotes?.[p.ticker]
    const live = caValue ?? q?.price ?? p.openingPrice
    add('fy26', p, sinceTracking(p.openingPrice, live))
  })

  return [...byName.values()].map((r) => {
    const played = [r.fy24?.ret, r.fy25?.ret, r.fy26?.ret].filter((v) => v != null)
    return { ...r, total: played.length ? played.reduce((a, b) => a + b, 0) : null, seasons: played.length }
  })
}

const posNeg = (v) => (v == null ? '' : v >= 0 ? 'pos' : 'neg')
const fmtOrDash = (v) => (v == null ? '—' : fmtPct(v))

export default function AllTime() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => {})
  }, [])

  const rows = useMemo(() => {
    return allTimeRows(data?.quotes).sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity))
  }, [data])

  return (
    <section className="section">
      <h2 className="section-title">All-Time Leaderboard</h2>
      <p className="section-sub">
        Every KORCH pick across all three seasons, ranked by the sum of each person's FY24, FY25,
        and FY26 returns. Not everyone has played all three seasons — the total is just the sum of
        whichever ones they have.
      </p>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Player</th>
                <th className="num">All-time total</th>
                <th>FY24 pick</th>
                <th className="num">FY24 return</th>
                <th>FY25 pick</th>
                <th className="num">FY25 return</th>
                <th>FY26 pick</th>
                <th className="num">FY26 return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <td className="num" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td className="person">{r.name}</td>
                  <td className={`num ${posNeg(r.total)}`} style={{ fontWeight: 700 }}>
                    {fmtOrDash(r.total)}
                  </td>
                  <td>{r.fy24 ? <span className="ticker">{r.fy24.ticker}</span> : '—'}</td>
                  <td className={`num ${posNeg(r.fy24?.ret)}`}>{fmtOrDash(r.fy24?.ret)}</td>
                  <td>{r.fy25 ? <span className="ticker">{r.fy25.ticker}</span> : '—'}</td>
                  <td className={`num ${posNeg(r.fy25?.ret)}`}>{fmtOrDash(r.fy25?.ret)}</td>
                  <td>{r.fy26 ? <span className="ticker">{r.fy26.ticker}</span> : '—'}</td>
                  <td className={`num ${posNeg(r.fy26?.ret)}`}>{fmtOrDash(r.fy26?.ret)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
