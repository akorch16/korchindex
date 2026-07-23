import { useEffect, useMemo, useState } from 'react'
import { fmtPct } from './LineChart'
import year2 from '../data/year2.json'
import year3 from '../data/year3.json'

function LiveTable({ rows, columns }) {
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Person</th>
              <th>Pick</th>
              {columns.map((c) => (
                <th key={c.key} className="num">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="person">{r.name}</td>
                <td><span className="ticker">{r.ticker}</span></td>
                {columns.map((c) => (
                  <td key={c.key} className={c.numClass ? c.numClass(r) : 'num'}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Live() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErr(true))
  }, [])

  const fy26Rows = useMemo(() => {
    return year3.people
      .map((p) => {
        const q = data?.quotes[p.ticker]
        const live = q?.price ?? null
        const since =
          live != null && p.openingPrice != null ? (live - p.openingPrice) / p.openingPrice : null
        return { ...p, live, since }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  const fy25Rows = useMemo(() => {
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
        }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  return (
    <>
      <section className="section">
        <h2 className="section-title">Live tracker</h2>
        <p className="section-sub">
          Every currently-tracked pick, refreshed automatically every weekday via the same
          scheduled GitHub Action — no servers, no fees, no fiduciary duty.
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

      <section className="section">
        <h3 className="chart-title" style={{ marginBottom: 4 }}>FY26 — current season</h3>
        <p className="chart-sub" style={{ margin: '0 0 12px' }}>
          Since each pick’s first tracked price ({year3.trackingSince}).
        </p>
        <LiveTable
          rows={fy26Rows}
          columns={[
            {
              key: 'since',
              label: `Since ${year3.trackingSince}`,
              render: (r) => (r.since == null ? (r.openingPrice == null ? 'pending' : '—') : fmtPct(r.since)),
              numClass: (r) => `num ${r.since == null ? '' : r.since >= 0 ? 'pos' : 'neg'}`,
            },
            { key: 'latest', label: 'Latest', render: (r) => (r.live != null ? `$${r.live.toFixed(2)}` : '—') },
          ]}
        />
      </section>

      {fy25Rows.length > 0 && (
        <section className="section">
          <h3 className="chart-title" style={{ marginBottom: 4 }}>FY25 — closed season, where are they now</h3>
          <p className="chart-sub" style={{ margin: '0 0 12px' }}>
            Drift since the October 10, 2025 close — for curiosity, not competition anymore.
          </p>
          <LiveTable
            rows={fy25Rows}
            columns={[
              { key: 'close', label: 'FY25 close', render: (r) => (r.close != null ? `$${r.close.toFixed(2)}` : '—') },
              { key: 'latest', label: 'Latest', render: (r) => (r.live != null ? `$${r.live.toFixed(2)}` : '—') },
              {
                key: 'since',
                label: 'Since close',
                render: (r) => (r.since == null ? '—' : fmtPct(r.since)),
                numClass: (r) => `num ${r.since == null ? '' : r.since >= 0 ? 'pos' : 'neg'}`,
              },
            ]}
          />
        </section>
      )}
    </>
  )
}
