import { useEffect, useMemo, useState } from 'react'
import { fmtMoney, fmtPct } from './LineChart'
import year3 from '../data/year3.json'
import { corporateActionValue } from './FY26'

const STAKE = 1000

// Current dollar value of one person's $1,000 FY26 stake, and its 24-hour
// dollar swing -- both measured off the same $1,000 basis scaled by price
// ratios, so a corporate-action pick (frozen payout, or a merger/rebrand's
// successor-share value) falls out of the same math with no special case:
// a frozen payout has today's price equal to yesterday's, so its swing is
// naturally $0.
function positionStats(p, quotes) {
  const caLive = corporateActionValue(p.corporateAction, quotes, 'price')
  const live = caLive ?? quotes?.[p.ticker]?.price ?? null
  const caPrev = corporateActionValue(p.corporateAction, quotes, 'prevClose')
  const prev = p.corporateAction ? caPrev : (quotes?.[p.ticker]?.prevClose ?? null)

  const value = live != null && p.openingPrice != null ? STAKE * (live / p.openingPrice) : STAKE
  const dailyReturn = live != null && prev != null && prev !== 0 ? (live - prev) / prev : null
  const dollarChange = dailyReturn != null ? value * dailyReturn : 0
  return { value, dollarChange }
}

export default function PortfolioValue() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/prices.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const positions = year3.people.map((p) => positionStats(p, data?.quotes))
    const start = year3.people.length * STAKE
    const total = positions.reduce((sum, p) => sum + p.value, 0)
    const dailyChange = positions.reduce((sum, p) => sum + p.dollarChange, 0)
    return { start, total, dailyChange, totalReturn: (total - start) / start }
  }, [data])

  return (
    <section className="section">
      <div className="kpi-row">
        <div className="tile hero">
          <div className="label">KORCH · Total value</div>
          <div className={`value ${stats.totalReturn >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(stats.total)}</div>
          <div className="note">
            {fmtMoney(stats.start)} starting point, implies {fmtPct(stats.totalReturn)}
          </div>
        </div>
        <div className="tile">
          <div className="label">24-hour change</div>
          <div className={`value ${stats.dailyChange >= 0 ? 'pos' : 'neg'}`}>
            {stats.dailyChange >= 0 ? '+' : '-'}
            {fmtMoney(Math.abs(stats.dailyChange))}
          </div>
          <div className="note">Across all {year3.people.length} FY26 picks</div>
        </div>
      </div>
    </section>
  )
}
