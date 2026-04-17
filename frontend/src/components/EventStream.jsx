import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime, clamp } from '../utils.js';

function Meter({ value, max = 100, tone = 'cyan', warn, danger }) {
  const pct = clamp((value / max) * 100, 0, 100);
  let toneClass = tone;
  if (danger !== undefined && value <= danger) toneClass = 'rose';
  else if (warn !== undefined && value <= warn) toneClass = 'amber';
  return (
    <div className={`meter meter-${toneClass}`}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
      <span className="meter-text">{value.toFixed(1)}%</span>
    </div>
  );
}

function TempPill({ value }) {
  let tone = 'cyan';
  if (value >= 82) tone = 'rose';
  else if (value >= 70) tone = 'amber';
  else if (value < 40) tone = 'violet';
  return <span className={`temp-pill temp-${tone}`}>{value.toFixed(1)}°C</span>;
}

export default function EventStream({ events }) {
  const [fresh, setFresh] = useState(new Set());
  const seen = useRef(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;
    const next = new Set();
    for (const e of events) {
      if (!seen.current.has(e.eventId)) {
        next.add(e.eventId);
        seen.current.add(e.eventId);
      }
    }
    if (next.size > 0) {
      setFresh(next);
      const t = setTimeout(() => setFresh(new Set()), 1600);
      return () => clearTimeout(t);
    }
    // prune seen to avoid unbounded growth
    if (seen.current.size > 500) {
      const keep = new Set(events.map((e) => e.eventId));
      seen.current = keep;
    }
  }, [events]);

  if (!events || events.length === 0) {
    return <p className="empty-hint">Stream will appear when the simulator starts.</p>;
  }

  return (
    <div className="event-stream">
      <div className="event-stream-head">
        <span>device</span>
        <span>status</span>
        <span>temp</span>
        <span>humidity</span>
        <span>battery</span>
        <span>signal</span>
        <span>region</span>
        <span>seen</span>
      </div>
      <div className="event-stream-body">
        {events.map((event) => (
          <div
            key={event.eventId}
            className={`event-row status-${event.status} ${
              fresh.has(event.eventId) ? 'is-fresh' : ''
            }`}
          >
            <span className="cell-device">
              <span className={`status-dot dot-${event.status}`} />
              <span className="device-id">{event.deviceId}</span>
              <span className="device-type">{event.deviceType}</span>
            </span>
            <span className={`cell status-chip chip-${event.status}`}>{event.status}</span>
            <span className="cell">
              <TempPill value={Number(event.temperatureC)} />
            </span>
            <span className="cell meter-cell">
              <Meter value={Number(event.humidityPct)} tone="cyan" />
            </span>
            <span className="cell meter-cell">
              <Meter value={Number(event.batteryPct)} tone="emerald" warn={35} danger={18} />
            </span>
            <span className="cell meter-cell">
              <Meter value={Number(event.signalStrength)} tone="violet" warn={35} danger={18} />
            </span>
            <span className="cell region-cell">{event.region}</span>
            <span className="cell time-cell">{formatRelativeTime(event.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
