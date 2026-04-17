# PulseGrid — Realtime Device Operations Console

A full-stack real-time device monitoring & event ingestion platform built to sustain
**5,000+ events/sec** from simulated IoT fleets, with an in-memory cache that cuts
per-batch processing latency to sub-millisecond, streamed live over WebSockets to a
custom React dashboard.

## What's inside

- **`backend/`** — Node.js + Express ingestion API, WebSocket hub, PostgreSQL
  persistence, and a rolling in-memory metrics cache (per-second buckets, device stats,
  recent events, alert feed, latency histograms).
- **`frontend/`** — Vite + React dashboard with a custom SVG chart stack, live pulse
  ring, animated KPI counters, regional breakdown, alert feed, and event stream.
- **`simulator/`** — Async Python generator that can post concurrent batches at >5K events/sec.
- **`docker-compose.yml`** — Local PostgreSQL for durable storage.

## Architecture highlights

- **High ingestion throughput.** Events arrive in bulk POSTs. The backend normalizes,
  derives threshold-based alerts, writes them to PostgreSQL inside a single
  transaction (with `ON CONFLICT DO NOTHING` for idempotency), and updates the
  in-memory cache. At 5K+ eps the dashboard reads only from cache — DB writes never
  block the WebSocket broadcast path.
- **Cache-accelerated metrics.** A single `MetricsCache` holds:
  - a 60-second rolling throughput sparkline (auto-advanced during idle seconds),
  - per-device latest telemetry,
  - recent events / alerts ring buffers,
  - latency histogram (avg + p95 of each ingest batch).
- **Throttled WebSocket broadcasts.** Instead of broadcasting on every ingest call
  (which would flood clients at 5K+ eps), the server broadcasts a single consolidated
  snapshot every second + an immediate `alerts_appended` push when a threshold trips.
- **Resilient startup.** If PostgreSQL is offline the backend starts in
  `cache-only` mode so the demo still works end-to-end.

## Quick start

```bash
docker compose up -d postgres

cd backend     && npm install
cd ../frontend && npm install
cd ../simulator && py -m pip install -r requirements.txt
```

Copy the `.env.example` files if you want to override hosts/ports.

### Run

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev

# terminal 3 — push 5,000 events/sec at 500 simulated devices
cd simulator && py main.py --devices 500 --rate 5000 --batch-size 200 --concurrency 16
```

Open the frontend URL that Vite prints (default `http://localhost:5173`).

## Simulator options

```bash
py main.py --help
```

Key flags:

| flag | default | purpose |
| --- | --- | --- |
| `--rate` | `5000` | approximate events/sec |
| `--batch-size` | `200` | events per HTTP POST |
| `--concurrency` | `16` | max in-flight POSTs |
| `--devices` | `500` | unique simulated devices |

The simulator reports observed rate every 2 seconds.

## API

- `GET  /health` — service & storage status
- `GET  /api/bootstrap` — summary + recent events + alerts + top devices
- `GET  /api/metrics/summary` — metrics snapshot (incl. per-second series, latency)
- `GET  /api/events/recent?limit=50`
- `GET  /api/alerts/recent?limit=20`
- `POST /api/events/bulk` — `{ events: [...] }`, returns `{ insertedEvents, generatedAlerts, latencyMs }`

## WebSocket

- `ws://<host>/ws`
- Server sends:
  - `bootstrap` on connection (full snapshot)
  - `tick` every second (summary + recent events/alerts/devices)
  - `alerts_appended` immediately when a new alert is generated

## Notes

- AWS deployment (EC2, S3, Dockerized services, GitHub Actions CI/CD) is handled
  separately and intentionally not part of this scope.
- Schema is auto-initialized on backend startup.
