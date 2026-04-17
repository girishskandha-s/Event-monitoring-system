import { isDatabaseReady, markDatabaseUnavailable, pool } from './db.js';
import { deriveAlerts } from './alerts.js';
import { metricsCache } from './cache.js';
import { websocketHub } from './websocketHub.js';

function normalizeEvent(rawEvent) {
  return {
    eventId: rawEvent.eventId,
    deviceId: rawEvent.deviceId,
    deviceType: rawEvent.deviceType || 'sensor',
    status: rawEvent.status || 'online',
    temperatureC: Number(rawEvent.temperatureC),
    humidityPct: Number(rawEvent.humidityPct),
    batteryPct: Number(rawEvent.batteryPct),
    signalStrength: Number(rawEvent.signalStrength),
    region: rawEvent.region || 'us-central',
    createdAt: rawEvent.createdAt || new Date().toISOString(),
  };
}

function buildBulkInsertPlaceholders(records, columns) {
  const values = [];
  const placeholders = records.map((record, rowIndex) => {
    const base = rowIndex * columns.length;
    const tuple = columns.map((column, columnIndex) => {
      values.push(record[column]);
      return `$${base + columnIndex + 1}`;
    });
    return `(${tuple.join(', ')})`;
  });

  return { placeholders, values };
}

const eventColumns = [
  'eventId',
  'deviceId',
  'deviceType',
  'status',
  'temperatureC',
  'humidityPct',
  'batteryPct',
  'signalStrength',
  'region',
  'createdAt',
];

const alertColumns = ['alertId', 'eventId', 'deviceId', 'severity', 'category', 'message', 'createdAt'];

export async function ingestEvents(rawEvents) {
  const startedAt = performance.now();
  const events = rawEvents.map(normalizeEvent);
  const alerts = deriveAlerts(events);

  if (isDatabaseReady()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (events.length > 0) {
        const { placeholders, values } = buildBulkInsertPlaceholders(events, eventColumns);
        await client.query(
          `
            INSERT INTO device_events (
              event_id,
              device_id,
              device_type,
              status,
              temperature_c,
              humidity_pct,
              battery_pct,
              signal_strength,
              region,
              created_at
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (event_id) DO NOTHING
          `,
          values
        );
      }

      if (alerts.length > 0) {
        const { placeholders, values } = buildBulkInsertPlaceholders(alerts, alertColumns);
        await client.query(
          `
            INSERT INTO alerts (
              alert_id,
              event_id,
              device_id,
              severity,
              category,
              message,
              created_at
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (alert_id) DO NOTHING
          `,
          values
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      markDatabaseUnavailable();
      console.warn('Database became unavailable, continuing in cache-only mode.', error.message);
    } finally {
      client.release();
    }
  }

  metricsCache.ingestEvents(events);
  metricsCache.ingestAlerts(alerts);

  const latencyMs = performance.now() - startedAt;
  metricsCache.recordLatency(latencyMs);

  // NOTE: we intentionally do NOT broadcast on every ingest call. At 5K+ eps
  // this would flood clients. A scheduled tick in index.js handles broadcasting.
  // We only fire a lightweight alerts broadcast so operators see alerts immediately.
  if (alerts.length > 0) {
    websocketHub.broadcast('alerts_appended', {
      alerts: alerts.slice(0, 8),
      totalAlerts: metricsCache.totalAlerts,
    });
  }

  return {
    insertedEvents: events.length,
    generatedAlerts: alerts.length,
    latencyMs: Number(latencyMs.toFixed(2)),
  };
}
