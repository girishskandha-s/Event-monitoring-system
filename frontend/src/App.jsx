import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

const defaultState = {
  summary: {
    totalEvents: 0,
    totalAlerts: 0,
    activeDevices: 0,
    deviceHealth: { online: 0, warning: 0, offline: 0 },
    liveRate: { eventsPerSecond: 0, alertsPerSecond: 0 },
    averages: { temperatureC: 0, batteryPct: 0 },
    throughputSeries: [],
  },
  recentEvents: [],
  recentAlerts: [],
  topDevices: [],
};

function formatRelativeTime(value) {
  if (!value) return 'No data';
  const diffMs = Date.now() - new Date(value).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function Sparkline({ points, color, fill }) {
  const values = points.length ? points : [0];
  const width = 220;
  const height = 64;
  const max = Math.max(...values, 1);
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 10) - 5;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" role="img">
      <path d={areaPath} fill={fill} />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ label, value, subtext, tone = 'default' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-subtext">{subtext}</span>
    </div>
  );
}

function App() {
  const [state, setState] = useState(defaultState);
  const [connection, setConnection] = useState('Connecting');

  useEffect(() => {
    let mounted = true;

    async function loadBootstrap() {
      const response = await fetch(`${API_BASE}/api/bootstrap`);
      const data = await response.json();
      if (mounted) {
        setState((current) => ({ ...current, ...data }));
      }
    }

    loadBootstrap().catch(() => {
      if (mounted) {
        setConnection('Backend unreachable');
      }
    });

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      if (mounted) setConnection('Live');
    };

    socket.onclose = () => {
      if (mounted) setConnection('Disconnected');
    };

    socket.onerror = () => {
      if (mounted) setConnection('Connection error');
    };

    socket.onmessage = (message) => {
      const parsed = JSON.parse(message.data);
      const { type, payload } = parsed;

      if (type === 'bootstrap' && mounted) {
        setState((current) => ({ ...current, ...payload }));
      }

      if (type === 'events_ingested' && mounted) {
        setState((current) => ({
          ...current,
          summary: payload.summary,
          recentEvents: payload.recentEvents,
          recentAlerts: payload.recentAlerts,
          topDevices: payload.topDevices,
        }));
      }

      if (type === 'summary_tick' && mounted) {
        setState((current) => ({
          ...current,
          summary: payload.summary,
          topDevices: payload.topDevices,
        }));
      }
    };

    return () => {
      mounted = false;
      socket.close();
    };
  }, []);

  const eventSeries = useMemo(
    () => state.summary.throughputSeries.map((point) => point.eventsPerSecond),
    [state.summary.throughputSeries]
  );

  const alertSeries = useMemo(
    () => state.summary.throughputSeries.map((point) => point.alertsPerSecond),
    [state.summary.throughputSeries]
  );

  const onlineRatio = state.summary.activeDevices
    ? Math.round((state.summary.deviceHealth.online / state.summary.activeDevices) * 100)
    : 0;

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="hero">
        <div>
          <p className="eyebrow">REAL-TIME DEVICE OBSERVABILITY</p>
          <h1>Real-time Events Dashboard</h1>
          <p className="hero-copy">
            Live telemetry, alerting, and fleet health for simulated IoT devices streaming into a
            resilient ingestion pipeline.
          </p>
        </div>
        <div className="hero-status">
          <span className={`status-pill ${connection === 'Live' ? 'live' : 'stale'}`}>
            {connection}
          </span>
          <div className="hero-mini-grid">
            <div>
              <span>Throughput</span>
              <strong>{state.summary.liveRate.eventsPerSecond} eps</strong>
            </div>
            <div>
              <span>Alerts</span>
              <strong>{state.summary.liveRate.alertsPerSecond} aps</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard
          label="Events Processed"
          value={state.summary.totalEvents.toLocaleString()}
          subtext="Cumulative event ingestion"
        />
        <MetricCard
          label="Alerts Triggered"
          value={state.summary.totalAlerts.toLocaleString()}
          subtext="Threshold-driven notifications"
          tone="warning"
        />
        <MetricCard
          label="Active Devices"
          value={state.summary.activeDevices.toLocaleString()}
          subtext={`${onlineRatio}% reporting healthy`}
        />
        <MetricCard
          label="Average Temperature"
          value={`${state.summary.averages.temperatureC} C`}
          subtext={`Battery avg ${state.summary.averages.batteryPct}%`}
          tone="cool"
        />
      </section>

      <section className="content-grid">
        <article className="panel large">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">INGESTION RATE</p>
              <h2>Live Throughput</h2>
            </div>
            <span>Rolling last 60 seconds</span>
          </div>
          <div className="chart-stack">
            <div className="chart-card">
              <div className="chart-copy">
                <strong>{state.summary.liveRate.eventsPerSecond} eps</strong>
                <span>Events per second</span>
              </div>
              <Sparkline points={eventSeries} color="#ff9f6e" fill="rgba(255, 159, 110, 0.18)" />
            </div>
            <div className="chart-card">
              <div className="chart-copy">
                <strong>{state.summary.liveRate.alertsPerSecond} aps</strong>
                <span>Alerts per second</span>
              </div>
              <Sparkline points={alertSeries} color="#ffd166" fill="rgba(255, 209, 102, 0.16)" />
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">FLEET HEALTH</p>
              <h2>Device Status</h2>
            </div>
          </div>
          <div className="health-list">
            <div>
              <span>Online</span>
              <strong>{state.summary.deviceHealth.online}</strong>
            </div>
            <div>
              <span>Warning</span>
              <strong>{state.summary.deviceHealth.warning}</strong>
            </div>
            <div>
              <span>Offline</span>
              <strong>{state.summary.deviceHealth.offline}</strong>
            </div>
          </div>
          <div className="device-strip">
            {state.topDevices.map((device) => (
              <div key={device.deviceId} className={`device-pill ${device.status}`}>
                <span>{device.deviceId}</span>
                <strong>{device.status}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">ALERT FEED</p>
              <h2>Recent Alerts</h2>
            </div>
          </div>
          <div className="feed">
            {state.recentAlerts.length === 0 ? (
              <p className="empty-state">Alerts will appear here when thresholds are exceeded.</p>
            ) : (
              state.recentAlerts.map((alert) => (
                <div key={alert.alertId} className={`feed-item severity-${alert.severity}`}>
                  <div>
                    <strong>{alert.category}</strong>
                    <p>{alert.message}</p>
                  </div>
                  <span>{formatRelativeTime(alert.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel large">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">EVENT STREAM</p>
              <h2>Latest Telemetry</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Temperature</th>
                  <th>Humidity</th>
                  <th>Battery</th>
                  <th>Signal</th>
                  <th>Region</th>
                  <th>Seen</th>
                </tr>
              </thead>
              <tbody>
                {state.recentEvents.map((event) => (
                  <tr key={event.eventId}>
                    <td>{event.deviceId}</td>
                    <td>
                      <span className={`status-badge ${event.status}`}>{event.status}</span>
                    </td>
                    <td>{event.temperatureC.toFixed(1)} C</td>
                    <td>{event.humidityPct.toFixed(1)}%</td>
                    <td>{event.batteryPct.toFixed(1)}%</td>
                    <td>{event.signalStrength.toFixed(1)}%</td>
                    <td>{event.region}</td>
                    <td>{formatRelativeTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

export default App;
