function buildAlert(event, severity, category, message) {
  return {
    alertId: `alt_${event.eventId}_${category}`,
    eventId: event.eventId,
    deviceId: event.deviceId,
    severity,
    category,
    message,
    createdAt: new Date().toISOString(),
  };
}

export function deriveAlerts(events) {
  const alerts = [];

  for (const event of events) {
    if (event.status === 'offline') {
      alerts.push(
        buildAlert(event, 'critical', 'device-offline', `Device ${event.deviceId} is offline`)
      );
    }

    if (Number(event.temperatureC) >= 82) {
      alerts.push(
        buildAlert(
          event,
          'high',
          'temperature',
          `High temperature on ${event.deviceId}: ${event.temperatureC.toFixed(1)} C`
        )
      );
    }

    if (Number(event.batteryPct) <= 18) {
      alerts.push(
        buildAlert(
          event,
          'medium',
          'battery',
          `Low battery on ${event.deviceId}: ${event.batteryPct.toFixed(1)}%`
        )
      );
    }

    if (Number(event.signalStrength) <= 18) {
      alerts.push(
        buildAlert(
          event,
          'medium',
          'signal',
          `Weak signal on ${event.deviceId}: ${event.signalStrength.toFixed(1)}%`
        )
      );
    }
  }

  return alerts;
}
