import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import { router } from './routes.js';
import { websocketHub } from './websocketHub.js';
import { metricsCache } from './cache.js';

const app = express();
app.use(
  cors({
    origin: config.frontendOrigin,
  })
);
app.use(express.json({ limit: '8mb' }));
app.use(router);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: 'Internal server error',
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function buildBootstrapPayload() {
  return {
    summary: metricsCache.getSummary(),
    recentEvents: metricsCache.getRecentEvents(30),
    recentAlerts: metricsCache.getRecentAlerts(12),
    topDevices: metricsCache.getTopDevices(12),
  };
}

wss.on('connection', (socket) => {
  websocketHub.add(socket);

  socket.send(
    JSON.stringify({
      type: 'bootstrap',
      payload: buildBootstrapPayload(),
      sentAt: new Date().toISOString(),
    })
  );

  socket.on('close', () => {
    websocketHub.remove(socket);
  });
});

// Single, steady 1Hz broadcast. Handles arbitrary ingest rates without flooding.
setInterval(() => {
  if (websocketHub.clients.size === 0) return;
  websocketHub.broadcast('tick', {
    summary: metricsCache.getSummary(),
    recentEvents: metricsCache.getRecentEvents(30),
    recentAlerts: metricsCache.getRecentAlerts(12),
    topDevices: metricsCache.getTopDevices(12),
  });
}, 1000);

initializeDatabase()
  .then(() => {
    console.log('PostgreSQL storage initialized.');
    server.listen(config.port, () => {
      console.log(`Backend listening on http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    if (!config.allowDegradedStartup) {
      console.error('Failed to initialize backend', error);
      process.exit(1);
    }

    console.warn('PostgreSQL unavailable. Starting in cache-only mode.', error.message);
    server.listen(config.port, () => {
      console.log(`Backend listening on http://localhost:${config.port}`);
    });
  });
