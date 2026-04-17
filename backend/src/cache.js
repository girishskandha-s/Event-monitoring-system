const MAX_RECENT_EVENTS = 200;
const MAX_RECENT_ALERTS = 100;
const SPARKLINE_POINTS = 60;

function nowSecondEpoch() {
  return Math.floor(Date.now() / 1000);
}

function createEmptySeries() {
  const base = nowSecondEpoch();
  return Array.from({ length: SPARKLINE_POINTS }, (_, index) => ({
    second: base - (SPARKLINE_POINTS - 1 - index),
    eventsPerSecond: 0,
    alertsPerSecond: 0,
  }));
}

export class MetricsCache {
  constructor() {
    this.startedAt = new Date();
    this.totalEvents = 0;
    this.totalAlerts = 0;
    this.recentEvents = [];
    this.recentAlerts = [];
    this.deviceStats = new Map();
    this.perSecond = createEmptySeries();
    this.ingestLatenciesMs = [];
    this.ingestBatches = 0;
  }

  // Advances the per-second series up to "targetSecond" by pushing empty buckets
  // for any seconds that passed with no events. This keeps the sparkline continuous
  // even when the ingestion pipeline idles.
  advanceSeriesTo(targetSecond) {
    const tail = this.perSecond[this.perSecond.length - 1];
    if (targetSecond <= tail.second) return tail;

    let current = tail.second;
    while (current < targetSecond) {
      current += 1;
      this.perSecond.push({
        second: current,
        eventsPerSecond: 0,
        alertsPerSecond: 0,
      });
      if (this.perSecond.length > SPARKLINE_POINTS) {
        this.perSecond.shift();
      }
    }
    return this.perSecond[this.perSecond.length - 1];
  }

  currentBucket() {
    return this.advanceSeriesTo(nowSecondEpoch());
  }

  recordLatency(ms) {
    this.ingestLatenciesMs.push(ms);
    if (this.ingestLatenciesMs.length > 500) this.ingestLatenciesMs.shift();
    this.ingestBatches += 1;
  }

  ingestEvents(events) {
    const bucket = this.currentBucket();
    for (const event of events) {
      this.totalEvents += 1;
      bucket.eventsPerSecond += 1;

      const existing = this.deviceStats.get(event.deviceId);
      const next = {
        deviceId: event.deviceId,
        deviceType: event.deviceType,
        status: event.status,
        lastSeen: event.createdAt,
        temperatureC: event.temperatureC,
        humidityPct: event.humidityPct,
        batteryPct: event.batteryPct,
        signalStrength: event.signalStrength,
        region: event.region,
        eventCount: (existing?.eventCount || 0) + 1,
      };

      this.deviceStats.set(event.deviceId, next);
      this.recentEvents.unshift(event);
    }

    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }
  }

  ingestAlerts(alerts) {
    if (alerts.length === 0) return;
    const bucket = this.currentBucket();
    for (const alert of alerts) {
      this.totalAlerts += 1;
      bucket.alertsPerSecond += 1;
      this.recentAlerts.unshift(alert);
    }

    if (this.recentAlerts.length > MAX_RECENT_ALERTS) {
      this.recentAlerts.length = MAX_RECENT_ALERTS;
    }
  }

  _getLatencyStats() {
    const samples = this.ingestLatenciesMs;
    if (samples.length === 0) return { avgMs: 0, p95Ms: 0, samples: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    return {
      avgMs: Number(avg.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      samples: sorted.length,
    };
  }

  getSummary() {
    this.currentBucket();

    const devices = Array.from(this.deviceStats.values());
    const connected = devices.filter((device) => device.status === 'online').length;
    const warning = devices.filter((device) => device.status === 'warning').length;
    const offline = devices.filter((device) => device.status === 'offline').length;

    const avgTemperature =
      devices.length === 0
        ? 0
        : devices.reduce((sum, device) => sum + Number(device.temperatureC), 0) / devices.length;
    const avgBattery =
      devices.length === 0
        ? 0
        : devices.reduce((sum, device) => sum + Number(device.batteryPct), 0) / devices.length;

    const series = this.perSecond;
    const tail = series[series.length - 1];

    const regionCounts = {};
    const typeCounts = {};
    for (const d of devices) {
      regionCounts[d.region] = (regionCounts[d.region] || 0) + 1;
      typeCounts[d.deviceType] = (typeCounts[d.deviceType] || 0) + 1;
    }

    const window = series.slice(-30);
    const avgEps = window.reduce((s, b) => s + b.eventsPerSecond, 0) / Math.max(window.length, 1);
    const peakEps = Math.max(...series.map((b) => b.eventsPerSecond), 0);

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      totalEvents: this.totalEvents,
      totalAlerts: this.totalAlerts,
      activeDevices: devices.length,
      deviceHealth: { online: connected, warning, offline },
      liveRate: {
        eventsPerSecond: tail.eventsPerSecond,
        alertsPerSecond: tail.alertsPerSecond,
        avgEventsPerSecond: Number(avgEps.toFixed(1)),
        peakEventsPerSecond: peakEps,
      },
      averages: {
        temperatureC: Number(avgTemperature.toFixed(1)),
        batteryPct: Number(avgBattery.toFixed(1)),
      },
      regionCounts,
      typeCounts,
      latency: this._getLatencyStats(),
      throughputSeries: series,
    };
  }

  getRecentEvents(limit = 50) {
    return this.recentEvents.slice(0, limit);
  }

  getRecentAlerts(limit = 20) {
    return this.recentAlerts.slice(0, limit);
  }

  getTopDevices(limit = 8) {
    return Array.from(this.deviceStats.values())
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(0, limit);
  }
}

export const metricsCache = new MetricsCache();
