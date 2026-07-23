import { useState } from 'react'
import FY26 from './components/FY26'
import Dashboard from './components/Dashboard'
import ArchiveY1 from './components/ArchiveY1'
import Newsletter from './components/Newsletter'
import Live from './components/Live'

const TABS = [
  { id: 'fy26', label: 'FY26', el: <FY26 /> },
  { id: 'dashboard', label: 'FY25 Dashboard', el: <Dashboard /> },
  { id: 'year1', label: 'Year 1 Archive', el: <ArchiveY1 /> },
  { id: 'letter', label: 'The Newsletter', el: <Newsletter /> },
  { id: 'live', label: 'Live Tracker', el: <Live /> },
]

export default function App() {
  const [tab, setTab] = useState('fy26')
  return (
    <div className="shell">
      <header className="masthead">
        <h1 className="wordmark">
          KORCH<span className="tick">↗</span>
        </h1>
        <p className="tagline">
          A friends &amp; family index fund. One pick each, ~$1,000 a pick, October to October.
          Not financial advice — arguably the opposite.
        </p>
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
