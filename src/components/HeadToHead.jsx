import { fmtPct } from './LineChart'

// A single-matchup "vs" card -- KORCH's overall return for the season
// against Warren Buffett's, no chart. Avatars are placeholder initials
// until real photos are dropped in (see korch_guy.png in App.jsx for the
// established pattern of wiring in an actual image later).
export default function HeadToHead({ title = 'Head to Head: KORCH vs. Warren Buffett', korchReturn, buffettReturn }) {
  const korchWins = korchReturn != null && buffettReturn != null && korchReturn > buffettReturn
  const buffettWins = korchReturn != null && buffettReturn != null && buffettReturn > korchReturn

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div className="matchup">
        <div className={`matchup-side${korchWins ? ' winner' : ''}`}>
          <div className="matchup-avatar korch">K</div>
          <div className="matchup-name">KORCH</div>
          <div className={`matchup-value ${korchReturn >= 0 ? 'pos' : 'neg'}`}>
            {korchReturn != null ? fmtPct(korchReturn) : '—'}
          </div>
        </div>
        <div className="matchup-vs">VS</div>
        <div className={`matchup-side${buffettWins ? ' winner' : ''}`}>
          <div className="matchup-avatar buffett">WB</div>
          <div className="matchup-name">Warren Buffett</div>
          <div className={`matchup-value ${buffettReturn >= 0 ? 'pos' : 'neg'}`}>
            {buffettReturn != null ? fmtPct(buffettReturn) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
