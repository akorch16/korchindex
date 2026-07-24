import { useEffect, useMemo, useState } from 'react'
import { RaceChart, fmtPct } from './LineChart'
import year3 from '../data/year3.json'

function sinceTracking(openingPrice, live) {
  return live != null && openingPrice != null ? (live - openingPrice) / openingPrice : null
}

// [0, chg-at-Q1, chg-at-Q2, ..., chg-at-now] for one entity, from its
// backfilled checkpointPrices plus the live "now" price as the open quarter.
function series(entity, live) {
  const cps = entity.checkpointPrices
  const open = cps?.[0] ?? entity.openingPrice
  const chg = (p) => (open != null && p != null ? (p - open) / open : null)
  const historical = (cps ?? []).slice(1).map(chg)
  return [0, ...historical, chg(live)]
}

// Average several entities' series index-by-index, ignoring gaps.
function averageOf(seriesList) {
  const len = Math.max(0, ...seriesList.map((s) => s.length))
  return Array.from({ length: len }, (_, i) => {
    const vals = seriesList.map((s) => s[i]).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })
}

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
        return { ...p, live, since: sinceTracking(p.openingPrice, live) }
      })
      .sort((a, b) => (b.since ?? -Infinity) - (a.since ?? -Infinity))
  }, [data])

  const benchmarks = useMemo(() => {
    return year3.benchmarks.map((b) => {
      const q = data?.quotes[b.ticker]
      const live = q?.price ?? b.openingPrice
      return { ...b, live, since: sinceTracking(b.openingPrice, live) }
    })
  }, [data])

  const tracked = rows.filter((r) => r.since != null)
  const pending = rows.filter((r) => r.openingPrice == null)
  const korch = tracked.length ? tracked.reduce((sum, r) => sum + r.since, 0) / tracked.length : null
  const sp = benchmarks.find((b) => b.ticker === 'VOO')
  const brk = benchmarks.find((b) => b.ticker === 'BRK.B')
  const best = tracked[0]
  const worst = tracked[tracked.length - 1]

  const raceLabels = useMemo(() => {
    const n = (year3.checkpointDates?.length ?? 1) + 1 // +1 for the live "now" point
    const labels = (year3.checkpointDates ?? [year3.seasonOpened]).map((d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    )
    labels.length = n - 1
    labels.push('Now')
    return labels
  }, [])

  return (
    <>
      <section className="section">
        <h2 className="section-title">FY26 — the picks are in</h2>
        <div className="kpi-row">
          <div className="tile hero">
            <div className="label">KORCH · FY26</div>
            <div className={`value ${korch != null && korch >= 0 ? 'pos' : korch != null ? 'neg' : ''}`}>
              {korch != null ? fmtPct(korch) : '—'}
            </div>
            <div className="note">avg. of {tracked.length} picks, since the FY26 open</div>
          </div>
          <div className="tile">
            <div className="label">S&P 500</div>
            <div className={`value ${sp?.since != null && sp.since >= 0 ? 'pos' : sp?.since != null ? 'neg' : ''}`}>
              {sp?.since != null ? fmtPct(sp.since) : '—'}
            </div>
            <div className="note">VOO, same window</div>
          </div>
          <div className="tile">
            <div className="label">Warren Buffett</div>
            <div className={`value ${brk?.since != null && brk.since >= 0 ? 'pos' : brk?.since != null ? 'neg' : ''}`}>
              {brk?.since != null ? fmtPct(brk.since) : '—'}
            </div>
            <div className="note">BRK.B, same window</div>
          </div>
          <div className="tile">
            <div className="label">Best pick</div>
            <div className={`value ${best && best.since >= 0 ? 'pos' : best ? 'neg' : ''}`}>
              {best ? fmtPct(best.since) : '—'}
            </div>
            <div className="note">{best ? best.ticker : 'check back tomorrow'}</div>
          </div>
          <div className="tile">
            <div className="label">Biggest loser</div>
            <div className={`value ${worst && worst.since >= 0 ? 'pos' : worst ? 'neg' : ''}`}>
              {worst ? fmtPct(worst.since) : '—'}
            </div>
            <div className="note">{worst ? worst.ticker : 'check back tomorrow'}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <RaceChart
          title="The race: KORCH vs. the professionals"
          sub="Cumulative return since the FY26 open — updated live, one quarter at a time."
          series={[
            {
              name: 'KORCH',
              color: 'var(--s1)',
              values: averageOf(rows.map((r) => series(r, r.live))),
              emphasis: true,
            },
            { name: 'S&P 500', color: 'var(--muted)', values: sp ? series(sp, sp.live) : [] },
            { name: 'W. Buffett', color: 'var(--baseline)', values: brk ? series(brk, brk.live) : [] },
          ]}
          xLabels={raceLabels}
        />
      </section>

      <section className="section">
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th className="num">Since FY26 open</th>
                  <th className="num">Opening price</th>
                  <th className="num">Latest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
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
            Live prices haven’t published yet today — showing each pick’s opening price.
          </p>
        )}
        <p className="footnote">
          “Since FY26 open” compares each price (including the S&P 500 and Warren Buffett benchmarks
          above) against that ticker’s actual close on the season’s October 28, 2025 start —
          backfilled from historical data, the same way FY24 and FY25 are tracked.
          {pending.length > 0 &&
            ` ${pending.map((p) => p.ticker).join(', ')} ${pending.length === 1 ? 'has' : 'have'} no reliable opening price yet (thin trading or a delisting around that date) and show as pending until that resolves.`}
        </p>
      </section>
    </>
  )
}
