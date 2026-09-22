import { Fragment } from 'react'
import { fmtPct } from './LineChart'

// A 3-way matchup card -- KORCH vs. the S&P 500 vs. Warren Buffett, no chart.
export default function HeadToHead({ title = 'Head to Head: KORCH vs. The Market', korchReturn, spReturn, buffettReturn }) {
  const base = import.meta.env.BASE_URL
  const entries = [
    { key: 'korch', name: 'KORCH', avatar: `${base}korch_guy_copy.png`, value: korchReturn },
    { key: 'buffett', name: 'Warren Buffett', avatar: `${base}warren_buffett.png`, value: buffettReturn },
    { key: 'sp', name: 'S&P 500', avatar: `${base}salt-and-pepper.webp`, value: spReturn, contain: true },
  ]
  const known = entries.filter((e) => e.value != null)
  const maxValue = known.length ? Math.max(...known.map((e) => e.value)) : null

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div className="matchup">
        {entries.map((e, i) => (
          <Fragment key={e.key}>
            <div className={`matchup-side${e.value != null && e.value === maxValue ? ' winner' : ''}`}>
              <img className={`matchup-avatar${e.contain ? ' contain' : ''}`} src={e.avatar} alt={e.name} />
              <div className="matchup-name">{e.name}</div>
              <div className={`matchup-value ${e.value >= 0 ? 'pos' : 'neg'}`}>
                {e.value != null ? fmtPct(e.value) : '—'}
              </div>
            </div>
            {i < entries.length - 1 && <div className="matchup-vs">VS</div>}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
