import { fmtPct } from './LineChart'

// A single-matchup "vs" card -- KORCH's overall return for the season
// against Warren Buffett's, no chart.
export default function HeadToHead({ title = 'Head to Head: KORCH vs. Warren Buffett', korchReturn, buffettReturn }) {
  const korchWins = korchReturn != null && buffettReturn != null && korchReturn > buffettReturn
  const buffettWins = korchReturn != null && buffettReturn != null && buffettReturn > korchReturn
  const base = import.meta.env.BASE_URL

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div className="matchup">
        <div className={`matchup-side${korchWins ? ' winner' : ''}`}>
          <img className="matchup-avatar" src={`${base}korch_guy_copy.png`} alt="KORCH" />
          <div className="matchup-name">KORCH</div>
          <div className={`matchup-value ${korchReturn >= 0 ? 'pos' : 'neg'}`}>
            {korchReturn != null ? fmtPct(korchReturn) : '—'}
          </div>
        </div>
        <div className="matchup-vs">VS</div>
        <div className={`matchup-side${buffettWins ? ' winner' : ''}`}>
          <img className="matchup-avatar" src={`${base}warren_buffett.png`} alt="Warren Buffett" />
          <div className="matchup-name">Warren Buffett</div>
          <div className={`matchup-value ${buffettReturn >= 0 ? 'pos' : 'neg'}`}>
            {buffettReturn != null ? fmtPct(buffettReturn) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
