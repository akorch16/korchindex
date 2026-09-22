import { Fragment } from 'react'

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
      <rect x="2.5" y="6" width="19" height="12" rx="2.2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 8.5v0M18 15.5v0" />
    </svg>
  )
}

function WagerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5v8a2.5 2.5 0 0 0 5 0v-8M9.5 2.5v6M7 2.5v6" />
      <path d="M17 2.5c-2 0-3 2-3 5s1 4 3 4v10" />
    </svg>
  )
}

const CARDS = [
  {
    icon: RosterIcon,
    label: 'The roster',
    accent: true,
    desc: (n) => (
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
        <Fragment key={c.label}>
          <div className="rules-card">
            <div className="rules-number">{String(i + 1).padStart(2, '0')}</div>
            <div className="rules-icon">
              <c.icon />
            </div>
            <div className="rules-label">{c.label}</div>
            <div className={`rules-value${c.accent ? ' accent' : ''}`}>{values[i]}</div>
            <p className="rules-desc">{c.desc(count)}</p>
          </div>
          {i < CARDS.length - 1 && (
            <div className="rules-arrow" aria-hidden="true">
              →
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
