import { useEffect, useRef, useState } from 'react'

export const fmtPct = (v, digits = 1) =>
  `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

export const fmtMoney = (v) =>
  v >= 1000
    ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceTicks(min, max, n = 5) {
  const span = max - min
  const step0 = span / (n - 1)
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag
  const lo = Math.floor(min / step) * step
  const ticks = []
  for (let t = lo; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1e9) / 1e9)
  return ticks
}

/**
 * Multi-series line chart: hairline grid, zero baseline, 2px lines,
 * direct end labels (collision-nudged), crosshair + tooltip on hover.
 * series: [{ name, color, values: (number|null)[], dash?, emphasis? }]
 * xLabels: string[] (same length as values)
 */
export default function LineChart({ series, xLabels, height = 300, yFmt = (v) => fmtPct(v, 0) }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const PAD = { top: 14, right: 118, bottom: 26, left: 52 }
  const W = Math.max(width, 320)
  const H = height
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom

  const all = series.flatMap((s) => s.values).filter((v) => v != null)
  let min = Math.min(0, ...all)
  let max = Math.max(0, ...all)
  if (min === max) max = min + 1
  const padY = (max - min) * 0.06
  min -= padY
  max += padY
  const ticks = niceTicks(min, max)
  min = Math.min(min, ticks[0])
  max = Math.max(max, ticks[ticks.length - 1])

  const n = xLabels.length
  const x = (i) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v) => PAD.top + ih - ((v - min) / (max - min)) * ih

  const path = (vals) => {
    let d = ''
    vals.forEach((v, i) => {
      if (v == null) return
      d += (d === '' ? 'M' : 'L') + `${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    return d
  }

  // end labels with collision nudge (min 15px apart)
  const ends = series
    .map((s, si) => {
      const lastIdx = s.values.map((v, i) => (v != null ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
      return lastIdx < 0 ? null : { si, name: s.name, color: s.color, yPos: y(s.values[lastIdx]), v: s.values[lastIdx] }
    })
    .filter(Boolean)
    .sort((a, b) => a.yPos - b.yPos)
  for (let i = 1; i < ends.length; i++)
    if (ends[i].yPos - ends[i - 1].yPos < 15) ends[i].yPos = ends[i - 1].yPos + 15

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / iw) * (n - 1))))
    setHover({ i, left: (x(i) / W) * rect.width, top: e.clientY - rect.top })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
              stroke={t === 0 ? 'var(--baseline)' : 'var(--grid)'}
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {yFmt(t)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {l}
          </text>
        ))}
        {hover != null && (
          <line x1={x(hover.i)} x2={x(hover.i)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--baseline)" strokeWidth={1} />
        )}
        {series.map((s, si) => (
          <path
            key={si}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.emphasis ? 2.5 : 2}
            strokeDasharray={s.dash ? '5 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover != null &&
          series.map((s, si) =>
            s.values[hover.i] == null ? null : (
              <circle
                key={si}
                cx={x(hover.i)} cy={y(s.values[hover.i])} r={4}
                fill={s.color} stroke="var(--surface)" strokeWidth={2}
              />
            )
          )}
        {ends.map((e) => (
          <g key={e.si}>
            <line
              x1={W - PAD.right + 4} x2={W - PAD.right + 14}
              y1={e.yPos} y2={e.yPos}
              stroke={e.color} strokeWidth={3} strokeLinecap="round"
            />
            <text x={W - PAD.right + 19} y={e.yPos + 4} fontSize="12" fontWeight="600" fill="var(--ink-2)">
              {e.name}
            </text>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div
          className="tooltip"
          style={{
            position: 'absolute',
            left: Math.min(hover.left + 12, W * 0.72),
            top: 8,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div className="t-label">{xLabels[hover.i]}</div>
          {[...series]
            .map((s) => ({ s, v: s.values[hover.i] }))
            .filter(({ v }) => v != null)
            .sort((a, b) => b.v - a.v)
            .map(({ s, v }) => (
              <div className="t-row" key={s.name}>
                <span className="swatch" style={{ width: 10, height: 3, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                {s.name}
                <span className="val">{fmtPct(v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ series }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span className="item" key={s.name}>
          <span className="swatch line" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}
