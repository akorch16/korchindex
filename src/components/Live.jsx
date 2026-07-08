import { useEffect, useMemo, useState } from 'react'
import { fmtPct } from './LineChart'
import year2 from '../data/year2.json'

export default function Live() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true))
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    return year2.people
      .map((p) => {
        const q = data.quotes[p.ticker]
        const close = p.prices[4]
        const live = q?.price
        return {
          ...p,
          close,
          live,
          since: live != null && close != null ? (live - close) / close : null,
          date: q?.date,
        }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  return (
    <>
      <section className="section">
        <h2 className="section-title">Live tracker — where are they now?</h2>
        <p className="section-sub">
          Every Year 2 pick, tracked past the closing bell. Prices refresh automatically every
          weekday via a scheduled GitHub Action — no servers, no fees, no fiduciary duty.
        </p>
        {data?.updated && (
          <p className="updated">Last updated {new Date(data.updated).toLocaleString()}</p>
        )}
        {err && (
          <div className="card">
            Live prices haven’t been published yet. The daily updater will populate them on its
            next run.
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="section">
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Pick</th>
                    <th className="num">FY25 close</th>
                    <th className="num">Latest</th>
                    <th className="num">Since Oct 10 ’25</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td className="person">{r.name}</td>
                      <td><span className="ticker">{r.ticker}</span></td>
                      <td className="num">{r.close != null ? `$${r.close.toFixed(2)}` : '—'}</td>
                      <td className="num">{r.live != null ? `$${r.live.toFixed(2)}` : '—'}</td>
                      <td className={`num ${r.since == null ? '' : r.since >= 0 ? 'pos' : 'neg'}`}>
                        {r.since == null ? '—' : fmtPct(r.since)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="footnote">
            KORCH Year 3 opened October 10, 2025. When the picks are in, they’ll show up here —
            start thinking of your stock picks.
          </p>
        </section>
      )}
    </>
  )
}
