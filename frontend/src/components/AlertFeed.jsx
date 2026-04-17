import { formatRelativeTime } from '../utils.js';

const CATEGORY_GLYPH = {
  'device-offline': '⎋',
  temperature: '≋',
  battery: '◔',
  signal: '∿',
};

export default function AlertFeed({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="empty-hint alert-empty">
        <span className="empty-spark" />
        No alerts. All thresholds nominal.
      </div>
    );
  }

  return (
    <ul className="alert-feed">
      {alerts.map((alert) => (
        <li key={alert.alertId} className={`alert-item severity-${alert.severity}`}>
          <span className="alert-glyph">{CATEGORY_GLYPH[alert.category] || '!'}</span>
          <div className="alert-body">
            <div className="alert-top">
              <span className="alert-category">{alert.category.replace('-', ' ')}</span>
              <span className="alert-device">{alert.deviceId}</span>
            </div>
            <p className="alert-message">{alert.message}</p>
          </div>
          <div className="alert-meta">
            <span className={`alert-sev-chip sev-${alert.severity}`}>{alert.severity}</span>
            <span className="alert-time">{formatRelativeTime(alert.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
