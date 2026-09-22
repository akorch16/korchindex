import { Fragment, useState } from 'react'
import { fmtPct } from './LineChart'

// The "Pick / Since [season] open / Opening price / Latest" table shared by
// every season page. `notes` (ticker -> {company, about, performance}) is
// optional -- when omitted (FY24/FY25, no stockNotes data) rows just aren't
// expandable. Rows are sorted by `since` descending, matching the "biggest
// winner first" ordering every season already used.
export default function RosterTable({ rows, sinceLabel, notes, errNote }) {
  const [expanded, setExpanded] = useState(() => new Set())

  const toggleExpanded = (ticker) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  const sorted = [...rows].sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))

  return (
    <>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Pick</th>
                <th className="num">Since {sinceLabel} open</th>
                <th className="num">Opening price</th>
                <th className="num">Latest</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const note = notes?.[r.ticker]
                const isOpen = expanded.has(r.ticker)
                return (
                  <Fragment key={r.name ?? r.ticker}>
                    <tr
                      className={note ? 'pick-row' : ''}
                      onClick={note ? () => toggleExpanded(r.ticker) : undefined}
                      role={note ? 'button' : undefined}
                      tabIndex={note ? 0 : undefined}
                      aria-expanded={note ? isOpen : undefined}
                      onKeyDown={
                        note
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleExpanded(r.ticker)
                              }
                            }
                          : undefined
                      }
                    >
                      <td>
                        <span className="ticker">{r.displayTicker ?? r.ticker}</span>
                        {note && <span className={`arrow ${isOpen ? 'open' : ''}`}>▸</span>}
                      </td>
                      <td className={`num ${r.since == null ? '' : r.since >= 0 ? 'pos' : 'neg'}`}>
                        {r.since == null ? 'pending' : fmtPct(r.since)}
                      </td>
                      <td className="num">{r.openingPrice != null ? `$${r.openingPrice.toFixed(2)}` : '—'}</td>
                      <td className="num">{r.latest != null ? `$${r.latest.toFixed(2)}` : '—'}</td>
                    </tr>
                    {isOpen && note && (
                      <tr className="detail-row">
                        <td colSpan={4}>
                          <div className="pick-detail">
                            <div className="pick-detail-company">{note.company}</div>
                            <p className="pick-detail-about">{note.about}</p>
                            <p className="pick-detail-performance">{note.performance}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {errNote && <p className="footnote">{errNote}</p>}
    </>
  )
}
