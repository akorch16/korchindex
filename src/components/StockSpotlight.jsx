import { useEffect, useState } from 'react'

// Logos for the "Not Sponsored/Endorsed/Supported By" strips double as the
// spotlight's company mark when that ticker happens to be the day's mover --
// not every FY26 ticker has one uploaded, so this is a bonus, shown only
// when a match exists.
const TICKER_LOGOS = {
  MMM: 'logo-3m.webp',
  AMZN: 'logo-amazon.webp',
  ASML: 'logo-asml.webp',
  BYND: 'logo-beyond-meat.webp',
  BEP: 'logo-brookfield.webp',
  CAT: 'logo-caterpillar.webp',
  COST: 'logo-costco.webp',
  EQIX: 'logo-equinix.webp',
  FIG: 'logo-figma.jpg',
  KTOS: 'logo-kratos.webp',
  META: 'logo-meta.webp',
  MSFT: 'logo-microsoft.webp',
  MRNA: 'logo-moderna.webp',
  MP: 'logo-mp-materials.webp',
  NEE: 'logo-nextera.webp',
  NKE: 'logo-nike.webp',
  NVDA: 'logo-nvidia.webp',
  PLTR: 'logo-palantir.webp',
  RDDT: 'logo-reddit.webp',
  NOW: 'logo-servicenow.webp',
  SHOP: 'logo-shopify.webp',
  SMCI: 'logo-supermicro.webp',
  SG: 'logo-sweetgreen.webp',
  TDY: 'logo-teledyne.webp',
  V: 'logo-visa.webp',
  ZS: 'logo-zscaler.webp',
}

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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const up = data.changePct >= 0
  const logo = TICKER_LOGOS[data.ticker]
  const base = import.meta.env.BASE_URL

  return (
    <section className="section">
      <h2 className="section-title">Daily Stock Spotlight: {dateLabel}</h2>
      <div className="card spotlight-card">
        <div className="spotlight-body">
          <div className="spotlight-who">
            {logo && <img className="spotlight-logo" src={`${base}${logo}`} alt="" />}
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
        {data.summary && <p className="spotlight-summary">{data.summary}</p>}
      </div>
    </section>
  )
}
