import { useEffect, useState } from 'react'

// "Stock of the day" -- FY26's biggest mover since market open, with a real
// news headline for it when one's available. Data comes from
// public/live/spotlight.json, written by scripts/update-spotlight.mjs
// alongside every price update. Renders nothing while loading or if the
// file/headline isn't there -- this is a bonus, not load-bearing content.
export default function StockSpotlight() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}live/spotlight.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return null

  const dateLabel = new Date(`${data.date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const up = data.changePct >= 0

  return (
    <section className="section">
      <h2 className="section-title">Daily Stock Spotlight</h2>
      <div className="card spotlight-card">
        <div className="spotlight-head">
          <span className="spotlight-eyebrow">{dateLabel}</span>
        </div>
        <div className="spotlight-body">
          <div className="spotlight-who">
            <span className="ticker">{data.ticker}</span>
            <span className="spotlight-company">{data.company}</span>
          </div>
          <div className={`spotlight-change ${up ? 'pos' : 'neg'}`}>
            {up ? '▲' : '▼'} {(Math.abs(data.changePct) * 100).toFixed(1)}% since open
          </div>
        </div>
        {data.headline && (
          <p className="spotlight-news">
            In the news:{' '}
            {data.link ? (
              <a href={data.link} target="_blank" rel="noreferrer">
                {data.headline}
              </a>
            ) : (
              data.headline
            )}
            {data.publisher && <span className="spotlight-publisher"> — {data.publisher}</span>}
          </p>
        )}
      </div>
    </section>
  )
}
