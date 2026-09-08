import { useState } from 'react'
import FY26 from './components/FY26'
import Dashboard from './components/Dashboard'
import ArchiveY1 from './components/ArchiveY1'

const TABS = [
  { id: 'fy26', label: 'FY26', el: <FY26 /> },
  { id: 'dashboard', label: 'FY25', el: <Dashboard /> },
  { id: 'year1', label: 'FY24', el: <ArchiveY1 /> },
]

export default function App() {
  const [tab, setTab] = useState('fy26')
  return (
    <div className="shell">
      <header className="hero">
        <nav className="hero-nav">
          <div className="hero-wordmark">
            KORCH<span className="tick">↗</span>
          </div>
          <div className="hero-links">
            <a href="#our-story">Our Story</a>
            <a href="#team">Team</a>
            <a href="#investing-philosophy">Investing Philosophy</a>
          </div>
        </nav>
        <h1 className="hero-headline">
          We invest like{' '}
          <span className="circle-wrap">
            nobody
            <svg className="circle-svg" viewBox="0 0 220 110" preserveAspectRatio="none" aria-hidden="true">
              <path d="M14,58 C10,30 40,10 90,8 C150,6 205,18 208,50 C210,78 175,98 110,100 C55,101 12,88 10,64" />
            </svg>
          </span>{' '}
          knows anything.
        </h1>
      </header>

      <section id="our-story" className="section">
        <h2 className="section-title">Our Story</h2>
        <p className="section-sub">
          On September 27, 2023, days before turning 35, Alex emailed 35 friends and family
          members with an idea he put simply:
        </p>
        <blockquote className="rationale">
          “The premise is pretty simple: can stock tips from my friends and family beat the
          markets?”
        </blockquote>
        <div className="letter">
          <p>
            The rules were straightforward. Everyone on the email got to pick one stock — anything
            tradeable on Robinhood, long only — and Alex put $1,000 behind each pick, $35,000 in
            total. After one season, the winner got taken to a dinner of their choosing; the
            biggest loser had to take Alex to dinner instead.
          </p>
          <p>
            Three seasons later, KORCH is still run the same way: a new round of picks every
            October, tracked against the S&amp;P 500 and Warren Buffett's Berkshire Hathaway.
          </p>
        </div>
      </section>

      <section id="team" className="section">
        <h2 className="section-title">Team</h2>
        <p className="section-sub">
          No fund managers, no finance degrees required — just whoever's willing to send a ticker
          and a one-line reason.
        </p>
        <div className="letter">
          <p>
            Each season, roughly three dozen friends and family members send in a pick — spanning
            Boomers to Gen Z, the U.S., Canada, Mexico, and the U.K., uncles, aunts, cousins,
            in-laws, and college roommates. Married couples are invited too, but pick
            independently: “wives and husbands are perfectly capable of making their own decisions
            without the other's input and expertise, thank you very much.”
          </p>
          <p>See who picked what, and why, on the FY24, FY25, and FY26 tabs below.</p>
        </div>
      </section>

      <section id="investing-philosophy" className="section">
        <h2 className="section-title">Investing Philosophy</h2>
        <p className="section-sub">There isn't one. That's kind of the point.</p>
        <ul className="philosophy-list">
          <li>$1,000 per pick, long only — anything tradeable on Robinhood counts.</li>
          <li>
            One pick per person, per season. No research requirement: you can spend thirty seconds
            on your decision, or research for hours and write a thousand words.
          </li>
          <li>Picks are held for the full season — no trading in or out.</li>
          <li>
            Performance is tracked against the S&amp;P 500 and Warren Buffett's Berkshire Hathaway
            (BRK.B), yielding, in the founder's own words, “arbitrary comparisons and sweeping
            conclusions with no statistical significance.”
          </li>
        </ul>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>{TABS.find((t) => t.id === tab).el}</main>

      <footer className="footnote">
        KORCH is not a registered investment vehicle. Past performance beating Warren Buffett is no
        guarantee of future performance beating Warren Buffett.
      </footer>
    </div>
  )
}
