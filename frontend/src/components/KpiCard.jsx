import { useEffect, useRef, useState } from 'react';

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = () => {
      const t = Math.min(1, (performance.now() - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

function MiniSpark({ data, color }) {
  if (!data || data.length === 0) return null;
  const width = 100;
  const height = 28;
  const max = Math.max(...data, 1);
  const path = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="kpi-spark" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function KpiCard({
  label,
  value,
  suffix,
  delta,
  tone = 'cyan',
  spark,
  sparkColor,
  footnote,
  format = (v) => Math.round(v).toLocaleString(),
}) {
  const animated = useCountUp(Number(value) || 0);

  return (
    <div className={`kpi-card tone-${tone}`}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {delta !== undefined && (
          <span className={`kpi-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="kpi-value-row">
        <strong className="kpi-value">{format(animated)}</strong>
        {suffix && <span className="kpi-suffix">{suffix}</span>}
      </div>
      {spark && spark.length > 0 && <MiniSpark data={spark} color={sparkColor || '#22d3ee'} />}
      {footnote && <span className="kpi-footnote">{footnote}</span>}
    </div>
  );
}
