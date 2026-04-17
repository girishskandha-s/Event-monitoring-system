import { useMemo, useState } from 'react';

/**
 * Dual-series area chart with gradient fill, axis grid, and hover crosshair.
 * Pure SVG, no deps.
 */
export default function ThroughputChart({ series }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const { width, height, pad } = { width: 820, height: 260, pad: { t: 18, r: 18, b: 26, l: 44 } };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const data = useMemo(() => {
    if (!series || series.length === 0) {
      return Array.from({ length: 60 }, (_, i) => ({
        second: i,
        eventsPerSecond: 0,
        alertsPerSecond: 0,
      }));
    }
    return series;
  }, [series]);

  const maxEvents = Math.max(...data.map((p) => p.eventsPerSecond), 1);
  const maxAlerts = Math.max(...data.map((p) => p.alertsPerSecond), 1);

  const niceMax = (() => {
    const target = Math.max(maxEvents, 5);
    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    const residual = target / magnitude;
    let niceResidual = 10;
    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    return niceResidual * magnitude;
  })();

  const xOf = (i) => pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const yOfEvents = (v) => pad.t + innerH - (v / niceMax) * innerH;
  const yOfAlerts = (v) => pad.t + innerH - (v / Math.max(maxAlerts, 5)) * innerH * 0.55;

  const eventPath = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfEvents(p.eventsPerSecond).toFixed(1)}`)
    .join(' ');
  const eventArea = `${eventPath} L ${xOf(data.length - 1).toFixed(1)} ${pad.t + innerH} L ${xOf(0).toFixed(1)} ${pad.t + innerH} Z`;

  const alertPath = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfAlerts(p.alertsPerSecond).toFixed(1)}`)
    .join(' ');

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = (niceMax / gridSteps) * i;
    const y = yOfEvents(value);
    return { y, value };
  });

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const hoverX = hovered ? xOf(hoverIdx) : null;

  function handleMove(e) {
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * width;
    if (x < pad.l || x > width - pad.r) {
      setHoverIdx(null);
      return;
    }
    const ratio = (x - pad.l) / innerW;
    const idx = Math.round(ratio * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }

  return (
    <div className="throughput-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="throughput-chart-svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="events-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="events-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="60%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="alerts-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={line.y}
              y2={line.y}
              stroke="rgba(148, 163, 184, 0.08)"
              strokeDasharray="3 4"
            />
            <text
              x={pad.l - 10}
              y={line.y + 4}
              fill="rgba(148, 163, 184, 0.55)"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              textAnchor="end"
            >
              {Math.round(line.value).toLocaleString()}
            </text>
          </g>
        ))}

        <path d={eventArea} fill="url(#events-gradient)" />
        <path
          d={eventPath}
          fill="none"
          stroke="url(#events-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={alertPath}
          fill="none"
          stroke="url(#alerts-stroke)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 3"
          opacity="0.85"
        />

        {hoverX !== null && (
          <g>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="rgba(34, 211, 238, 0.55)"
              strokeWidth="1"
            />
            <circle
              cx={hoverX}
              cy={yOfEvents(hovered.eventsPerSecond)}
              r="5"
              fill="#0b0d1a"
              stroke="#22d3ee"
              strokeWidth="2"
            />
            <circle
              cx={hoverX}
              cy={yOfAlerts(hovered.alertsPerSecond)}
              r="4"
              fill="#0b0d1a"
              stroke="#fbbf24"
              strokeWidth="2"
            />
          </g>
        )}

        <text
          x={pad.l}
          y={pad.t + innerH + 18}
          fill="rgba(148, 163, 184, 0.55)"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
        >
          -60s
        </text>
        <text
          x={width - pad.r}
          y={pad.t + innerH + 18}
          fill="rgba(148, 163, 184, 0.55)"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="end"
        >
          now
        </text>
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: `${((hoverX - 0) / width) * 100}%` }}
        >
          <div>
            <span className="dot events" />
            <strong>{hovered.eventsPerSecond.toLocaleString()}</strong>
            <span className="tooltip-label">events/sec</span>
          </div>
          <div>
            <span className="dot alerts" />
            <strong>{hovered.alertsPerSecond.toLocaleString()}</strong>
            <span className="tooltip-label">alerts/sec</span>
          </div>
        </div>
      )}
    </div>
  );
}
