const REGION_ACCENT = {
  'us-east': '#22d3ee',
  'us-west': '#a78bfa',
  'eu-central': '#34d399',
  'ap-south': '#fbbf24',
  'us-central': '#f472b6',
};

export default function RegionBreakdown({ counts }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

  if (entries.length === 0) {
    return <p className="empty-hint">Waiting for devices to report…</p>;
  }

  return (
    <div className="region-breakdown">
      {entries.map(([region, count]) => {
        const pct = (count / total) * 100;
        const color = REGION_ACCENT[region] || '#22d3ee';
        return (
          <div key={region} className="region-row">
            <div className="region-row-head">
              <span className="region-name">
                <span className="region-dot" style={{ background: color }} />
                {region}
              </span>
              <span className="region-value">
                <strong>{count.toLocaleString()}</strong>
                <span className="region-pct">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="region-bar">
              <div
                className="region-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}55, ${color})`,
                  boxShadow: `0 0 18px ${color}66`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
