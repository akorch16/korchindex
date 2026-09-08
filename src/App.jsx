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
