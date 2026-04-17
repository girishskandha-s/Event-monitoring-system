import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

let databaseReady = false;

const schemaSql = `
CREATE TABLE IF NOT EXISTS device_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  device_type TEXT NOT NULL,
  status TEXT NOT NULL,
  temperature_c NUMERIC(6, 2) NOT NULL,
  humidity_pct NUMERIC(6, 2) NOT NULL,
  battery_pct NUMERIC(6, 2) NOT NULL,
  signal_strength NUMERIC(6, 2) NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_events_created_at ON device_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events (device_id);
CREATE INDEX IF NOT EXISTS idx_device_events_status ON device_events (status);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_id TEXT UNIQUE NOT NULL,
  event_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
`;

export async function initializeDatabase() {
  await pool.query(schemaSql);
  databaseReady = true;
}

export function isDatabaseReady() {
  return databaseReady;
}

export function markDatabaseUnavailable() {
  databaseReady = false;
}
