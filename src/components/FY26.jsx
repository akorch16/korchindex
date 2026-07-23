import { useEffect, useMemo, useState } from 'react'
import { fmtPct } from './LineChart'
import year3 from '../data/year3.json'

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
        const q = data?.quotes[p.ticker]
        const live = q?.price ?? p.openingPrice
        const since =
          live != null && p.openingPrice != null ? (live - p.openingPrice) / p.openingPrice : null
        return { ...p, live, since }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  const tracked = rows.filter((r) => r.openingPrice != null)
  const pending = rows.filter((r) => r.openingPrice == null)
  const movers = tracked.filter((r) => r.since !== 0)
  const best = movers.length ? movers[0] : null

  return (
    <>
      <section className="section">
        <h2 className="section-title">FY26 — the picks are in</h2>
        <p className="section-sub">
          KORCH Year 3 opened October 10, 2025. Forty-two picks, tracking live now — prices refresh
          automatically every weekday via the same scheduled updater as everything else here.
        </p>
        <div className="kpi-row">
          <div className="tile hero">
            <div className="label">Picks locked in</div>
            <div className="value">{year3.people.length}</div>
            <div className="note">FY26 roster</div>
          </div>
          <div className="tile">
            <div className="label">Tracking since</div>
            <div className="value">{year3.trackingSince}</div>
            <div className="note">first verified price for each pick</div>
          </div>
          <div className="tile">
            <div className="label">Early mover</div>
            <div className={`value ${best && best.since >= 0 ? 'pos' : best ? 'neg' : ''}`}>
              {best ? fmtPct(best.since) : '—'}
            </div>
            <div className="note">{best ? `${best.ticker} — ${best.name}` : 'check back tomorrow'}</div>
          </div>
          <div className="tile">
            <div className="label">Pending quotes</div>
            <div className="value">{pending.length}</div>
            <div className="note">
              {pending.length ? pending.map((p) => p.ticker).join(', ') : 'all tickers resolved'}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Pick</th>
                  <th className="num">Since tracking began</th>
                  <th className="num">Price</th>
                  <th className="num">Latest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className="person">{r.name}</td>
                    <td><span className="ticker">{r.ticker}</span></td>
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
            Live prices haven’t published yet today — showing each pick’s tracked-since price.
          </p>
        )}
        <p className="footnote">
          “Since tracking began” compares each price against the first verified quote captured for
          that ticker ({year3.trackingSince}), not the true October 10 season open — historical
          pricing that far back wasn’t available when this page went up. It’ll read as 0.0% today
          and start moving with tomorrow’s price update.
        </p>
      </section>
    </>
  )
}
