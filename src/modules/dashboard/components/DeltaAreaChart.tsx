import { useMemo, useState } from 'react'

export type DeltaSample = {
  /** Stable identifier so consumers can map tooltip clicks back to a round. */
  id: string
  /** Round date in ms; 0 if missing. */
  dateMs: number
  /** Strokes vs par. */
  delta: number
}

type Props = {
  samples: DeltaSample[]
  formatDate: (dateMs: number) => string
  formatDelta: (delta: number) => string
  'aria-label': string
}

type Point = { x: number; y: number }

const VIEW_W = 600
const VIEW_H = 160
const PAD_X = 16
const PAD_TOP = 18
const PAD_BOTTOM = 12

function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]!
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }
  const segments: string[] = [`M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`]
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]!
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    segments.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    )
  }
  return segments.join(' ')
}

/** Lightweight SVG area chart with hover/focus tooltips, no external library. */
export function DeltaAreaChart({
  samples,
  formatDate,
  formatDelta,
  'aria-label': ariaLabel,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const layout = useMemo(() => {
    if (samples.length === 0) return null
    const innerW = VIEW_W - PAD_X * 2
    const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM

    const deltas = samples.map((s) => s.delta)
    const rawMin = Math.min(...deltas, 0)
    const rawMax = Math.max(...deltas, 0)
    const minY = rawMin - 0.5
    const maxY = rawMax + 0.5
    const spanY = Math.max(maxY - minY, 1)

    const yFor = (delta: number) => {
      const ny = (delta - minY) / spanY
      return PAD_TOP + (1 - ny) * innerH
    }
    const xFor = (index: number) => {
      if (samples.length === 1) return PAD_X + innerW / 2
      return PAD_X + (index / (samples.length - 1)) * innerW
    }

    const points: Point[] = samples.map((sample, index) => ({
      x: xFor(index),
      y: yFor(sample.delta),
    }))

    const lineD = smoothPath(points)
    const baseY = yFor(0)
    const last = points[points.length - 1]!
    const first = points[0]!
    const areaD = `${lineD} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`

    return { points, lineD, areaD, baseY, minY, maxY }
  }, [samples])

  if (!layout) return null
  const { points, lineD, areaD, baseY } = layout

  const active = activeIndex !== null && activeIndex >= 0 && activeIndex < samples.length
    ? { sample: samples[activeIndex]!, point: points[activeIndex]! }
    : null

  function handleSvgPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = VIEW_W / rect.width
    const localX = (event.clientX - rect.left) * ratio
    let nearestIndex = 0
    let nearestDistance = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - localX)
      if (d < nearestDistance) {
        nearestDistance = d
        nearestIndex = i
      }
    })
    setActiveIndex(nearestIndex)
  }

  function handleSvgPointerLeave() {
    setActiveIndex(null)
  }

  const tooltipLeftPct = active ? (active.point.x / VIEW_W) * 100 : 0
  const tooltipAbove = active ? active.point.y > VIEW_H / 2 : true

  return (
    <div className="delta-area-chart">
      <svg
        className="delta-area-chart__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
      >
        <defs>
          <linearGradient id="delta-area-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          className="delta-area-chart__zero"
          x1={PAD_X}
          x2={VIEW_W - PAD_X}
          y1={baseY}
          y2={baseY}
        />
        <path className="delta-area-chart__area" d={areaD} fill="url(#delta-area-chart-fill)" />
        <path
          className="delta-area-chart__line"
          d={lineD}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const isActive = activeIndex === i
          return (
            <g key={samples[i]!.id}>
              {isActive ? (
                <line
                  className="delta-area-chart__crosshair"
                  x1={p.x}
                  x2={p.x}
                  y1={PAD_TOP}
                  y2={VIEW_H - PAD_BOTTOM}
                />
              ) : null}
              <circle
                className={`delta-area-chart__dot${isActive ? ' delta-area-chart__dot--active' : ''}`}
                cx={p.x}
                cy={p.y}
                r={isActive ? 5 : 3}
                tabIndex={0}
                role="button"
                aria-label={`${formatDate(samples[i]!.dateMs)}: ${formatDelta(samples[i]!.delta)}`}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex((current) => (current === i ? null : current))}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setActiveIndex(i)
                }}
              />
            </g>
          )
        })}
      </svg>
      {active ? (
        <div
          className={`delta-area-chart__tooltip${tooltipAbove ? '' : ' delta-area-chart__tooltip--below'}`}
          style={{ left: `${tooltipLeftPct}%` }}
          role="status"
        >
          <span className="delta-area-chart__tooltip-date">{formatDate(active.sample.dateMs)}</span>
          <span className="delta-area-chart__tooltip-delta">{formatDelta(active.sample.delta)}</span>
        </div>
      ) : null}
    </div>
  )
}
