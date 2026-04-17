const MAX_RECENT_EVENTS = 200;
const MAX_RECENT_ALERTS = 100;
const SPARKLINE_POINTS = 60;

function createEmptySeries() {
  return Array.from({ length: SPARKLINE_POINTS }, (_, index) => ({
    second: index,
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
    this.lastSecondKey = null;
  }

  ensureCurrentSecondBucket(timestamp) {
    const secondKey = new Date(timestamp);
    secondKey.setMilliseconds(0);
    const key = secondKey.toISOString();

    if (this.lastSecondKey === key) {
      return this.perSecond[this.perSecond.length - 1];
    }

    if (this.lastSecondKey !== key) {
      const previousTail = this.perSecond[this.perSecond.length - 1];
      const nextBucket = {
        second: previousTail.second + 1,
        eventsPerSecond: 0,
        alertsPerSecond: 0,
      };

      this.perSecond.push(nextBucket);
      if (this.perSecond.length > SPARKLINE_POINTS) {
        this.perSecond.shift();
      }
      this.lastSecondKey = key;
      return nextBucket;
    }
  }

  ingestEvents(events) {
    for (const event of events) {
      this.totalEvents += 1;
      this.ensureCurrentSecondBucket(event.createdAt).eventsPerSecond += 1;

      const existing = this.deviceStats.get(event.deviceId) || {
        deviceId: event.deviceId,
        deviceType: event.deviceType,
        status: event.status,
        lastSeen: event.createdAt,
        temperatureC: event.temperatureC,
        humidityPct: event.humidityPct,
        batteryPct: event.batteryPct,
        signalStrength: event.signalStrength,
        region: event.region,
        eventCount: 0,
      };

      const next = {
        ...existing,
        status: event.status,
        lastSeen: event.createdAt,
        temperatureC: event.temperatureC,
        humidityPct: event.humidityPct,
        batteryPct: event.batteryPct,
        signalStrength: event.signalStrength,
        region: event.region,
        eventCount: existing.eventCount + 1,
      };

      this.deviceStats.set(event.deviceId, next);
      this.recentEvents.unshift(event);
    }

    this.recentEvents = this.recentEvents.slice(0, MAX_RECENT_EVENTS);
  }

  ingestAlerts(alerts, timestamp = new Date().toISOString()) {
    for (const alert of alerts) {
      this.totalAlerts += 1;
      this.ensureCurrentSecondBucket(timestamp).alertsPerSecond += 1;
      this.recentAlerts.unshift(alert);
    }

    this.recentAlerts = this.recentAlerts.slice(0, MAX_RECENT_ALERTS);
  }

  getSummary() {
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

    const tail = this.perSecond[this.perSecond.length - 1] || {
      eventsPerSecond: 0,
      alertsPerSecond: 0,
    };

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      totalEvents: this.totalEvents,
      totalAlerts: this.totalAlerts,
      activeDevices: devices.length,
      deviceHealth: {
        online: connected,
        warning,
        offline,
      },
      liveRate: {
        eventsPerSecond: tail.eventsPerSecond,
        alertsPerSecond: tail.alertsPerSecond,
      },
      averages: {
        temperatureC: Number(avgTemperature.toFixed(1)),
        batteryPct: Number(avgBattery.toFixed(1)),
      },
      throughputSeries: this.perSecond,
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
