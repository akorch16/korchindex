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
      <circle cx="12" cy="13" r="5" />
      <path d="M3 2v6c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2V2" />
      <path d="M6.5 2v20" />
      <path d="M20 2c-2.6 0-4.5 2.3-4.5 5.5S17.4 13 20 13" />
      <path d="M20 2v20" />
    </svg>
  )
}

const CARDS = [
  {
    icon: RosterIcon,
    label: 'The Braintrust',
    accent: true,
    desc: () => <>Friends &amp; family each pick a stock.</>,
  },
  {
    icon: StakeIcon,
    label: 'The stake',
    accent: true,
    desc: () => (
      <>
        Invested in each pick. Held for <b>one year</b>.
      </>
    ),
  },
  {
    icon: WagerIcon,
    label: 'The wager',
    accent: true,
    desc: () => (
      <>
        I buy the <b>winner</b> dinner. <b>Loser</b> buys me dinner.
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
