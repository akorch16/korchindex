import { useMemo, useState } from 'react'
import { fmtPct } from './LineChart'

// --- small stats helpers (Pearson/Spearman correlation + significance) ---
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

function pearson(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom ? num / denom : 0
}

function linreg(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den ? num / den : 0
  return { slope, intercept: my - slope * mx }
}

// Two-tailed significance of a correlation coefficient via Student's t,
// evaluated through the regularized incomplete beta function (standard
// numeric-recipes-style continued-fraction approximation -- no stats
// library available in a browser bundle).
function lgamma(z) {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  z -= 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
function betacf(x, a, b) {
  const MAXIT = 200
  const EPS = 3e-9
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function betai(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(x, a, b)) / a : 1 - (bt * betacf(1 - x, b, a)) / b
}
function pValue(r, n) {
  if (n <= 2 || Math.abs(r) >= 1) return r === 0 ? 1 : 0
  const t = r * Math.sqrt((n - 2) / (1 - r * r))
  const df = n - 2
  return betai(df / (df + t * t), df / 2, 0.5)
}

function pairsFor(rows, xKey, yKey) {
  return rows
    .map((r) => ({ name: r.name, x: r[xKey]?.ret, y: r[yKey]?.ret }))
    .filter((d) => d.x != null && d.y != null)
}

function statsFor(pairs) {
  const xs = pairs.map((d) => d.x)
  const ys = pairs.map((d) => d.y)
  const n = xs.length
  const r = n > 1 ? pearson(xs, ys) : 0
  return { n, r, p: n > 2 ? pValue(r, n) : 1 }
}

function Stat({ label, r, n, p }) {
  const sig = n > 2 && p < 0.05
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{n > 1 ? r.toFixed(2) : '—'}</div>
      <div className="note">
        {n > 2 ? `n=${n}, p=${p.toFixed(3)} — ${sig ? 'statistically significant' : 'not significant'}` : `n=${n}`}
      </div>
    </div>
  )
}

// Compact x/y scatter: fixed design-space viewBox (scales responsively via
// the SVG's own width:100%), zero-reference lines, a best-fit line, and a
// nearest-point hover tooltip -- the same visual language as LineChart's
// charts (hairline grid, tooltip card) but for x/y pairs instead of a time
// series.
function Scatter({ title, sub, points, xLabel, yLabel }) {
  const [hover, setHover] = useState(null)
  const W = 420
  const H = 260
  const PAD = { top: 14, right: 16, bottom: 28, left: 44 }
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom

  const xs = points.map((d) => d.x)
  const ys = points.map((d) => d.y)
  const pad = (arr) => {
    let lo = Math.min(0, ...arr)
    let hi = Math.max(0, ...arr)
    if (lo === hi) hi = lo + 1
    const p = (hi - lo) * 0.1
    return [lo - p, hi + p]
  }
  const [xMin, xMax] = pad(xs)
  const [yMin, yMax] = pad(ys)
  const x = (v) => PAD.left + ((v - xMin) / (xMax - xMin)) * iw
  const y = (v) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih

  const { slope, intercept } = linreg(xs, ys)
  const clampY = (v) => Math.min(yMax, Math.max(yMin, v))
  const lineY1 = clampY(slope * xMin + intercept)
  const lineY2 = clampY(slope * xMax + intercept)

  const xTicks = [xMin + (xMax - xMin) * 0.1, 0, xMax - (xMax - xMin) * 0.1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  )
  const yTicks = [yMin + (yMax - yMin) * 0.15, 0, yMax - (yMax - yMin) * 0.15]

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const py = ((e.clientY - rect.top) / rect.height) * H
    let best = null
    let bestDist = Infinity
    points.forEach((d, i) => {
      const dx = x(d.x) - px
      const dy = y(d.y) - py
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    if (best != null && bestDist < 400) setHover(best)
    else setHover(null)
  }

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3 className="chart-title">{title}</h3>
        <p className="chart-sub">{sub}</p>
      </div>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--baseline)" strokeWidth={1} />
          <line x1={x(0)} x2={x(0)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--baseline)" strokeWidth={1} />
          {yTicks.map((t) => (
            <text key={`y${t}`} x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {fmtPct(t, 0)}
            </text>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {fmtPct(t, 0)}
            </text>
          ))}
          <line x1={x(xMin)} x2={x(xMax)} y1={lineY1} y2={lineY2} stroke="var(--s5)" strokeWidth={2} strokeDasharray="5 4" />
          {points.map((d, i) => (
            <circle
              key={d.name}
              cx={x(d.x)}
              cy={y(d.y)}
              r={hover === i ? 5 : 3.5}
              fill="var(--s1)"
              fillOpacity={hover === i ? 1 : 0.7}
              stroke="var(--surface)"
              strokeWidth={hover === i ? 1.5 : 0}
            />
          ))}
        </svg>
        {hover != null && (
          <div
            className="tooltip"
            style={{
              position: 'absolute',
              left: `${(x(points[hover].x) / W) * 100}%`,
              top: `${(y(points[hover].y) / H) * 100}%`,
              transform: 'translate(-50%, -115%)',
              pointerEvents: 'none',
              zIndex: 2,
              whiteSpace: 'nowrap',
            }}
          >
            <div className="t-label">{points[hover].name}</div>
            <div className="t-row">
              {xLabel} <span className="val">{fmtPct(points[hover].x)}</span>
            </div>
            <div className="t-row">
              {yLabel} <span className="val">{fmtPct(points[hover].y)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function interpretation(entries) {
  const describe = (s, label) => {
    if (s.n < 8) return `${label}: not enough people who played both seasons yet to say anything (n=${s.n}).`
    if (s.p >= 0.05) {
      return `${label} shows no meaningful relationship (r = ${s.r.toFixed(2)}, p = ${s.p.toFixed(2)}) — statistically indistinguishable from noise.`
    }
    const verdict =
      s.r < 0
        ? 'mean reversion — people who did well tended to do worse next time, not better'
        : 'real (if modest) persistence — people who did well tended to keep doing well'
    return `${label} shows a statistically significant relationship (r = ${s.r.toFixed(2)}, p = ${s.p.toFixed(3)}): ${verdict}.`
  }
  return `${entries.map(({ stats, label }) => describe(stats, label)).join(' ')} Sample sizes here are small (under 45 people either way), so treat this as suggestive, not proof.`
}

export default function PredictivePower({ rows }) {
  const fy24to26Pairs = useMemo(() => pairsFor(rows, 'fy24', 'fy26'), [rows])
  const fy25to26Pairs = useMemo(() => pairsFor(rows, 'fy25', 'fy26'), [rows])
  const fy24to25Pairs = useMemo(() => pairsFor(rows, 'fy24', 'fy25'), [rows])
  const fy24to26Stats = useMemo(() => statsFor(fy24to26Pairs), [fy24to26Pairs])
  const fy25to26Stats = useMemo(() => statsFor(fy25to26Pairs), [fy25to26Pairs])
  const fy24to25Stats = useMemo(() => statsFor(fy24to25Pairs), [fy24to25Pairs])

  return (
    <section className="section">
      <h2 className="section-title">Does past performance predict future picks?</h2>
      <p className="section-sub">
        Every player who's picked in more than one season is a natural test: did a big win in one
        season predict a big win in the next? Each dot is one person — their return in the earlier
        season (x-axis) against their return in the later one (y-axis) — with a best-fit line
        through them.
      </p>
      <div className="kpi-row">
        <Stat label="FY24 → FY26 correlation" r={fy24to26Stats.r} n={fy24to26Stats.n} p={fy24to26Stats.p} />
        <Stat label="FY25 → FY26 correlation" r={fy25to26Stats.r} n={fy25to26Stats.n} p={fy25to26Stats.p} />
        <Stat label="FY24 → FY25 correlation" r={fy24to25Stats.r} n={fy24to25Stats.n} p={fy24to25Stats.p} />
      </div>
      <div className="showdown-grid">
        <Scatter title="FY24 return vs. FY26 return" sub="Skipping a year." points={fy24to26Pairs} xLabel="FY24" yLabel="FY26" />
        <Scatter title="FY25 return vs. FY26 return" sub="Back-to-back seasons." points={fy25to26Pairs} xLabel="FY25" yLabel="FY26" />
        <Scatter
          title="FY24 return vs. FY25 return"
          sub="Consecutive seasons, before FY26."
          points={fy24to25Pairs}
          xLabel="FY24"
          yLabel="FY25"
        />
      </div>
      <p className="section-sub" style={{ marginTop: 16, marginBottom: 0 }}>
        {interpretation([
          { stats: fy24to26Stats, label: 'Skipping a year (FY24 → FY26)' },
          { stats: fy25to26Stats, label: 'Back-to-back seasons (FY25 → FY26)' },
          { stats: fy24to25Stats, label: 'The prior pair of seasons (FY24 → FY25)' },
        ])}
      </p>
    </section>
  )
}
