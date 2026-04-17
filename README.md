# Real-Time Event Monitoring System

A local-first full-stack event monitoring platform with:

- Node.js backend for event ingestion, persistence, metrics aggregation, and WebSocket streaming
- React dashboard for live metrics, alerts, and event visualization
- Python simulator for generating IoT telemetry at configurable rates
- PostgreSQL for durable event and alert storage

## Architecture

- `backend/`: Express API, WebSocket server, PostgreSQL integration, in-memory metrics cache
- `frontend/`: Vite + React real-time dashboard
- `simulator/`: Async Python device event generator
- `docker-compose.yml`: Local PostgreSQL service

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Install simulator dependencies

```bash
cd simulator
py -m pip install -r requirements.txt
```

### 5. Configure environment

Copy `backend/.env.example` to `backend/.env` if you want to override defaults.
Copy `frontend/.env.example` to `frontend/.env` if you want to override the API host.

### 6. Start the backend

```bash
cd backend
npm run dev
```

This initializes the database schema automatically on startup.
If PostgreSQL is unavailable, the backend still starts in `cache-only` mode so you can demo the live dashboard and simulator flow locally.

### 7. Start the frontend

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

### 8. Start the simulator

```bash
cd simulator
py main.py --devices 250 --rate 200 --batch-size 50
```

## Useful Commands

### Backend

```bash
npm run dev
npm start
```

### Frontend

```bash
npm run dev
npm run build
```

### Simulator

```bash
py main.py --help
```

## API Overview

- `GET /health`
- `GET /api/bootstrap`
- `GET /api/metrics/summary`
- `GET /api/events/recent?limit=50`
- `GET /api/alerts/recent?limit=20`
- `POST /api/events/bulk`

## Notes

- The backend keeps a rolling in-memory cache for live metrics and recent events to avoid repeated aggregate queries.
- Alerts are generated automatically from incoming telemetry thresholds.
- AWS deployment is intentionally not included yet, per current scope.
- PostgreSQL is the primary storage path, but the backend can fall back to cache-only mode during local demos if Docker Desktop is not running.
