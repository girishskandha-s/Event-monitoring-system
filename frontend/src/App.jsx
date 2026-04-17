import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCompactNumber, formatDuration } from './utils.js';
import KpiCard from './components/KpiCard.jsx';
import PulseRing from './components/PulseRing.jsx';
import ThroughputChart from './components/ThroughputChart.jsx';
import RegionBreakdown from './components/RegionBreakdown.jsx';
import AlertFeed from './components/AlertFeed.jsx';
import EventStream from './components/EventStream.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

const defaultState = {
  summary: {
    uptimeSeconds: 0,
    totalEvents: 0,
    totalAlerts: 0,
    activeDevices: 0,
    deviceHealth: { online: 0, warning: 0, offline: 0 },
    liveRate: {
      eventsPerSecond: 0,
      alertsPerSecond: 0,
      avgEventsPerSecond: 0,
      peakEventsPerSecond: 0,
    },
    averages: { temperatureC: 0, batteryPct: 0 },
    regionCounts: {},
    typeCounts: {},
    latency: { avgMs: 0, p95Ms: 0, samples: 0 },
    throughputSeries: [],
  },
  recentEvents: [],
  recentAlerts: [],
  topDevices: [],
};

function useClock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

function useLiveSocket(onMessage, setConnection) {
  const onMessageRef = useRef(onMessage);
  const setConnectionRef = useRef(setConnection);
  onMessageRef.current = onMessage;
  setConnectionRef.current = setConnection;

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let closed = false;

    function connect() {
      setConnectionRef.current('connecting');
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnectionRef.current('live');
      socket.onclose = () => {
        if (closed) return;
        setConnectionRef.current('offline');
        reconnectTimer = setTimeout(connect, 2000);
      };
      socket.onerror = () => setConnectionRef.current('offline');
      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          onMessageRef.current(parsed);
        } catch (_) {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, []);
}

function ConnectionPill({ status }) {
  const label =
    status === 'live' ? 'Streaming' : status === 'connecting' ? 'Connecting' : 'Offline';
  return (
    <span className={`conn-pill conn-${status}`}>
      <span className="conn-dot" />
      {label}
    </span>
  );
}

function App() {
  const [state, setState] = useState(defaultState);
  const [connection, setConnection] = useState('connecting');
  useClock(); // rerender every second so relative times refresh

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/bootstrap`);
        const data = await res.json();
        if (!cancelled) setState((c) => ({ ...c, ...data }));
      } catch (_) {
        // websocket will retry and deliver bootstrap payload
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useLiveSocket((parsed) => {
    const { type, payload } = parsed || {};
    if (!payload) return;
    if (type === 'bootstrap' || type === 'tick') {
      setState((c) => ({
        ...c,
        summary: payload.summary || c.summary,
        recentEvents: payload.recentEvents || c.recentEvents,
        recentAlerts: payload.recentAlerts || c.recentAlerts,
        topDevices: payload.topDevices || c.topDevices,
      }));
    } else if (type === 'alerts_appended') {
      setState((c) => ({
        ...c,
        recentAlerts: [...(payload.alerts || []), ...c.recentAlerts].slice(0, 12),
      }));
    }
  }, setConnection);

  const summary = state.summary;
  const series = summary.throughputSeries;

  const eventSpark = useMemo(() => series.map((p) => p.eventsPerSecond), [series]);
  const alertSpark = useMemo(() => series.map((p) => p.alertsPerSecond), [series]);
  const batterySpark = useMemo(() => series.map((p) => p.eventsPerSecond + 1).reverse(), [series]);
  const tempSpark = useMemo(() => series.map((_, i) => 40 + Math.sin(i / 6) * 10), [series]);

  const healthyPct = summary.activeDevices
    ? (summary.deviceHealth.online / summary.activeDevices) * 100
    : 0;

  const alertRatePct = summary.totalEvents
    ? (summary.totalAlerts / summary.totalEvents) * 100
    : 0;

  return (
    <div className="app-shell">
      <div className="grid-backdrop" aria-hidden="true" />
      <div className="glow glow-cyan" aria-hidden="true" />
      <div className="glow glow-violet" aria-hidden="true" />
      <div className="glow glow-amber" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-text">
            <strong>PulseGrid</strong>
            <span>Realtime Device Operations Console</span>
          </div>
        </div>
        <div className="topbar-meta">
          <div className="meta-block">
            <span>uptime</span>
            <strong>{formatDuration(summary.uptimeSeconds)}</strong>
          </div>
          <div className="meta-block">
            <span>avg latency</span>
            <strong>{summary.latency.avgMs.toFixed(1)}ms</strong>
          </div>
          <div className="meta-block">
            <span>p95 latency</span>
            <strong>{summary.latency.p95Ms.toFixed(1)}ms</strong>
          </div>
          <ConnectionPill status={connection} />
        </div>
      </header>

      <section className="hero-row">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> live telemetry pipeline
          </p>
          <h1>
            <span className="hero-gradient">Observe</span> every device.{' '}
            <span className="hero-accent">React</span> in milliseconds.
          </h1>
          <p className="hero-lede">
            Ingesting simulated IoT telemetry at production scale — cached in memory, streamed over
            WebSockets, and visualized the instant a threshold is crossed.
          </p>

          <div className="hero-stats">
            <div>
              <span>peak throughput</span>
              <strong>
                {formatCompactNumber(summary.liveRate.peakEventsPerSecond)}
                <em>eps</em>
              </strong>
            </div>
            <div>
              <span>rolling avg (30s)</span>
              <strong>
                {formatCompactNumber(summary.liveRate.avgEventsPerSecond)}
                <em>eps</em>
              </strong>
            </div>
            <div>
              <span>alert ratio</span>
              <strong>
                {alertRatePct.toFixed(2)}
                <em>%</em>
              </strong>
            </div>
          </div>
        </div>

        <PulseRing
          value={summary.liveRate.eventsPerSecond}
          peak={summary.liveRate.peakEventsPerSecond || 1}
        />
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Events ingested"
          value={summary.totalEvents}
          tone="cyan"
          format={formatCompactNumber}
          spark={eventSpark}
          sparkColor="#22d3ee"
          footnote={`${summary.liveRate.eventsPerSecond.toLocaleString()} eps now`}
        />
        <KpiCard
          label="Alerts triggered"
          value={summary.totalAlerts}
          tone="amber"
          format={formatCompactNumber}
          spark={alertSpark}
          sparkColor="#fbbf24"
          footnote={`${summary.liveRate.alertsPerSecond.toLocaleString()} aps now`}
        />
        <KpiCard
          label="Active devices"
          value={summary.activeDevices}
          tone="violet"
          format={formatCompactNumber}
          spark={batterySpark}
          sparkColor="#a78bfa"
          footnote={`${healthyPct.toFixed(0)}% healthy`}
        />
        <KpiCard
          label="Avg temperature"
          value={summary.averages.temperatureC}
          suffix="°C"
          tone="emerald"
          format={(v) => v.toFixed(1)}
          spark={tempSpark}
          sparkColor="#34d399"
          footnote={`battery avg ${summary.averages.batteryPct.toFixed(0)}%`}
        />
      </section>

      <section className="main-grid">
        <article className="panel panel-chart">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">ingestion</p>
              <h2>Throughput · last 60s</h2>
            </div>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-swatch sw-events" />
                events/sec
              </span>
              <span className="legend-item">
                <span className="legend-swatch sw-alerts" />
                alerts/sec
              </span>
            </div>
          </div>
          <ThroughputChart series={series} />
        </article>

        <article className="panel panel-fleet">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">fleet</p>
              <h2>Device health</h2>
            </div>
            <span className="panel-tag">{summary.activeDevices} total</span>
          </div>

          <div className="health-donut">
            <HealthDonut health={summary.deviceHealth} total={summary.activeDevices} />
            <div className="health-legend">
              <div className="h-row">
                <span className="dot dot-online" />
                <span className="h-label">online</span>
                <strong>{summary.deviceHealth.online}</strong>
              </div>
              <div className="h-row">
                <span className="dot dot-warning" />
                <span className="h-label">warning</span>
                <strong>{summary.deviceHealth.warning}</strong>
              </div>
              <div className="h-row">
                <span className="dot dot-offline" />
                <span className="h-label">offline</span>
                <strong>{summary.deviceHealth.offline}</strong>
              </div>
            </div>
          </div>

          <div className="region-block">
            <p className="panel-kicker mini">regions</p>
            <RegionBreakdown counts={summary.regionCounts} />
          </div>
        </article>

        <article className="panel panel-alerts">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">alerts</p>
              <h2>Live alert stream</h2>
            </div>
            <span className="panel-tag tag-amber">
              {state.recentAlerts.length} active
            </span>
          </div>
          <AlertFeed alerts={state.recentAlerts} />
        </article>

        <article className="panel panel-stream">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">telemetry</p>
              <h2>Event stream</h2>
            </div>
            <span className="panel-tag">showing {state.recentEvents.length}</span>
          </div>
          <EventStream events={state.recentEvents} />
        </article>
      </section>

      <footer className="footer">
        <span>
          PulseGrid — Node.js · PostgreSQL · React · WebSockets ·{' '}
          <span className="footer-accent">cache-accelerated ingestion</span>
        </span>
        <span>
          {summary.latency.samples > 0
            ? `${summary.latency.samples} batch samples analyzed`
            : 'Awaiting first ingestion batch…'}
        </span>
      </footer>
    </div>
  );
}

function HealthDonut({ health, total }) {
  const size = 140;
  const r = 58;
  const stroke = 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const safeTotal = total || 1;

  const onlineFrac = (health.online || 0) / safeTotal;
  const warningFrac = (health.warning || 0) / safeTotal;
  const offlineFrac = (health.offline || 0) / safeTotal;

  const arc = (frac, offset, color) => {
    const len = frac * circumference;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${circumference - len}`}
        strokeDashoffset={-offset * circumference + circumference * 0.25}
        strokeLinecap="butt"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    );
  };

  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="rgba(148, 163, 184, 0.1)"
          strokeWidth={stroke}
          fill="none"
        />
        {arc(onlineFrac, 0, '#34d399')}
        {arc(warningFrac, onlineFrac, '#fbbf24')}
        {arc(offlineFrac, onlineFrac + warningFrac, '#fb7185')}
      </svg>
      <div className="donut-center">
        <strong>{total.toLocaleString()}</strong>
        <span>devices</span>
      </div>
    </div>
  );
}

export default App;
