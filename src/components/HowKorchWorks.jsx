// Icon-forward "how it works" cards -- roster, stake, wager -- replacing the
// plain bullet list. Copy is season-agnostic except the roster count, which
// each season page passes in.

function RosterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8.5" r="2.6" />
      <path d="M15.5 14.2c2.8.4 5 2.8 5 5.8" />
    </svg>
  )
}

function StakeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.5v11" />
      <path d="M15 9.3c0-1.3-1.3-2.3-3-2.3s-3 .9-3 2.1c0 1.3 1.2 1.8 3 2.2c1.9.4 3 .9 3 2.2c0 1.2-1.3 2.1-3 2.1s-3-1-3-2.3" />
    </svg>
  )
}

function WagerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" />
      <path d="M12 13v6.5M8.5 21.5h7" />
    </svg>
  )
}

const CARDS = [
  {
    icon: RosterIcon,
    label: 'The roster',
    accent: true,
    desc: () => (
      <>
        Friends &amp; family, each on the clock for exactly <b>one stock pick</b>.
      </>
    ),
  },
  {
    icon: StakeIcon,
    label: 'The stake',
    accent: false,
    desc: () => (
      <>
        Real money, in every single pick — held for <b>a full year</b>.
      </>
    ),
  },
  {
    icon: WagerIcon,
    label: 'The wager',
    accent: true,
    desc: () => (
      <>
        <b>Winner</b> picks the restaurant. <b>Loser</b> picks up the tab.
      </>
    ),
  },
]

export default function HowKorchWorks({ count }) {
  const values = [String(count), '$1,000', 'Dinner']

  return (
    <div className="rules-grid">
      {CARDS.map((c, i) => (
        <div className="rules-card" key={c.label}>
          <div className="rules-icon">
            <c.icon />
          </div>
          <div className="rules-label">{c.label}</div>
          <div className={`rules-value${c.accent ? ' accent' : ''}`}>{values[i]}</div>
          <p className="rules-desc">{c.desc()}</p>
        </div>
      ))}
    </div>
  )
}
