import { Router } from 'express';
import { metricsCache } from './cache.js';
import { ingestEvents } from './eventService.js';
import { isDatabaseReady } from './db.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'realtime-monitoring-backend',
    storage: isDatabaseReady() ? 'postgresql' : 'cache-only',
    timestamp: new Date().toISOString(),
  });
});

router.get('/api/bootstrap', (_req, res) => {
  res.json({
    summary: metricsCache.getSummary(),
    recentEvents: metricsCache.getRecentEvents(30),
    recentAlerts: metricsCache.getRecentAlerts(12),
    topDevices: metricsCache.getTopDevices(12),
  });
});

router.get('/api/metrics/summary', (_req, res) => {
  res.json(metricsCache.getSummary());
});

router.get('/api/events/recent', (req, res) => {
  const limit = Number(req.query.limit || 50);
  res.json(metricsCache.getRecentEvents(limit));
});

router.get('/api/alerts/recent', (req, res) => {
  const limit = Number(req.query.limit || 20);
  res.json(metricsCache.getRecentAlerts(limit));
});

router.post('/api/events/bulk', async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body?.events) ? req.body.events : [];
    if (payload.length === 0) {
      return res.status(400).json({ error: 'Request body must include a non-empty events array.' });
    }

    const result = await ingestEvents(payload);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});
