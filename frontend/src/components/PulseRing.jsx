import { useEffect, useRef, useState } from 'react';

/**
 * Circular "heartbeat" visualization of events/sec.
 * - Outer ring: fills proportional to current rate vs peak
 * - Inner: animated pulse dots driven by actual rate
 */
export default function PulseRing({ value, peak, label = 'events/sec' }) {
  const target = Math.max(peak, value, 10);
  const ratio = Math.min(1, value / target);

  const size = 220;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = ratio * circumference;

  const [displayValue, setDisplayValue] = useState(value);
  const rafRef = useRef(null);
  const fromRef = useRef(value);
  const toRef = useRef(value);
  const startRef = useRef(performance.now());

  useEffect(() => {
    fromRef.current = displayValue;
    toRef.current = value;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);

    const step = () => {
      const elapsed = performance.now() - startRef.current;
      const t = Math.min(1, elapsed / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplayValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="pulse-ring">
      <svg viewBox={`0 0 ${size} ${size}`} className="pulse-ring-svg">
        <defs>
          <linearGradient id="pulse-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="60%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <radialGradient id="pulse-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.35)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={r + 24} fill="url(#pulse-glow)" />

        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="rgba(148, 163, 184, 0.14)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="url(#pulse-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          fill="none"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />

        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r - 16 - i * 12}
            fill="none"
            stroke="rgba(34, 211, 238, 0.12)"
            strokeDasharray="2 6"
          />
        ))}
      </svg>

      <div className="pulse-ring-inner">
        <span className="pulse-ring-value">
          {Math.round(displayValue).toLocaleString()}
        </span>
        <span className="pulse-ring-label">{label}</span>
        <span className="pulse-ring-sub">peak {peak.toLocaleString()}</span>
      </div>

      <span className={`pulse-beacon ${value > 0 ? 'active' : ''}`} />
    </div>
  );
}
