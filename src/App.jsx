import { useState } from 'react'
import FY26 from './components/FY26'
import Dashboard from './components/Dashboard'
import ArchiveY1 from './components/ArchiveY1'
import AllTime from './components/AllTime'

const TABS = [
  { id: 'fy26', label: 'FY26', el: <FY26 /> },
  { id: 'dashboard', label: 'FY25', el: <Dashboard /> },
  { id: 'year1', label: 'FY24', el: <ArchiveY1 /> },
  { id: 'alltime', label: 'All-Time', el: <AllTime /> },
]

function OurStory() {
  return (
    <section className="section">
      <h2 className="section-title">Our Story</h2>
      <p className="section-sub">
        On September 27, 2023, days before turning 35, Alex emailed 35 friends and family members
        — everyone on BCC. Here's the email, verbatim:
      </p>
      <div className="letter">
        <p>Hi friends and family,</p>
        <p>I’m creating an index fund. It’s called KORCH.</p>
        <p>The premise is pretty simple: can stock tips from my friends and family beat the markets?</p>
        <p>
          Since I’m about to turn 35, I’m asking 35 people to pick a stock for me. That’s you
          (everyone is on BCC). I’ll invest $1,000 in each for a total of $35,000. That’s a lot of
          money for me, but I can tolerate risk here.
        </p>
        <p>
          The stock can be anything that you can buy on Robinhood (crypto, Chipotle, Cisco, etc),
          and it has to be long, not short.
        </p>
        <p>
          Just to be clear, I am not asking you to invest any money in KORCH, but I’d be curious to
          hear an explanation justifying your choice. You can spend thirty seconds on your decision
          and give me a few words. You can also research for hours and write 1,000 words.
        </p>
        <p>
          The investment period is for one year. After one year, I’ll take the winner out to a
          dinner of their choosing. The biggest loser takes me out to a dinner of my choosing.
          Should you be in a different city or country, I’ll find a way to come to you.
        </p>
        <p>
          If you are married, I’ve also invited your spouse, even if you primarily manage the
          money. I’d request that your picks remain independent from one another. Wives and
          husbands are perfectly capable of making their own decisions without the other’s input
          and expertise, thank you very much.
        </p>
        <p>
          You can submit your stock tip to me any time in the next week, but I’d like your picks
          by Tuesday morning, October 3rd. I’ll put in orders to buy immediately when the markets
          open on Wednesday morning.
        </p>
        <p>
          I may send out quarterly reports with graphs, analysis, and commentary making arbitrary
          comparisons and drawing sweeping conclusions with no statistical significance.
        </p>
        <p className="sig">
          Love,
          <br />
          Alex
        </p>
      </div>
    </section>
  )
}

function Team() {
  return (
    <section className="section">
      <h2 className="section-title">Team</h2>
      <p className="section-sub">
        No fund managers, no finance degrees required — just whoever's willing to send a ticker
        and a one-line reason.
      </p>
      <div className="letter">
        <p>
          Each season, roughly three dozen friends and family members send in a pick — spanning
          Boomers to Gen Z, the U.S., Canada, Mexico, and the U.K., uncles, aunts, cousins,
          in-laws, and college roommates. Married couples are invited too, but pick independently:
          “wives and husbands are perfectly capable of making their own decisions without the
          other's input and expertise, thank you very much.”
        </p>
        <p>See who picked what, and why, on the FY24, FY25, and FY26 tabs.</p>
      </div>
    </section>
  )
}

function InvestingPhilosophy() {
  return (
    <section className="section">
      <h2 className="section-title">Investing Philosophy</h2>
      <p className="section-sub">This page intentionally left blank because there is none.</p>
    </section>
  )
}

const PAGES = {
  'our-story': { label: 'Our Story', el: <OurStory /> },
  team: { label: 'Team', el: <Team /> },
  'investing-philosophy': { label: 'Investing Philosophy', el: <InvestingPhilosophy /> },
}

export default function App() {
  const [tab, setTab] = useState('fy26')
  const [page, setPage] = useState('home')

  return (
    <div className="shell">
      <header className="hero">
        <nav className="hero-nav">
          <button type="button" className="hero-wordmark" onClick={() => setPage('home')}>
            <svg className="mark" width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
              <rect x="8" y="8" width="84" height="84" rx="18" fill="var(--accent)" />
              <line x1="34" y1="26" x2="34" y2="74" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
              <line x1="34" y1="52" x2="60" y2="74" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
              <line x1="34" y1="52" x2="66" y2="26" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
              <polyline points="52,26 66,26 66,40" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            KORCH
          </button>
          <div className="hero-links">
            {Object.entries(PAGES).map(([id, p]) => (
              <button
                key={id}
                type="button"
                className={page === id ? 'active' : ''}
                onClick={() => setPage(id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </nav>
        {page === 'home' && (
          <div className="hero-row">
            <h1 className="hero-headline">
              We invest like{' '}
              <span className="circle-wrap">
                nobody
                <svg className="circle-svg" viewBox="0 0 220 110" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M14,58 C10,30 40,10 90,8 C150,6 205,18 208,50 C210,78 175,98 110,100 C55,101 12,88 10,64" />
                </svg>
              </span>{' '}
              knows anything.
              <span className="guy-line">
                Especially not this guy.
                <svg className="guy-arrow" viewBox="0 0 160 60" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4,50 C50,62 80,10 130,18 C140,20 148,16 154,8" />
                  <path d="M154,8 L142,10 M154,8 L148,20" />
                </svg>
              </span>
            </h1>
            <img className="guy-photo" src={`${import.meta.env.BASE_URL}korch_guy.png`} alt="" />
          </div>
        )}
      </header>

      {page === 'home' ? (
        <>
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
        </>
      ) : (
        <main>{PAGES[page].el}</main>
      )}

      <footer className="footnote">
        KORCH is not a registered investment vehicle. Past performance beating Warren Buffett is no
        guarantee of future performance beating Warren Buffett.
      </footer>
    </div>
  )
}
