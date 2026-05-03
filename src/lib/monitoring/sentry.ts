// Sentry stub — Build 2.7.
// Provider-neutral stubs. Replace with real Sentry SDK when DSN is configured.
// npm install @sentry/react @sentry/browser — then update this file.

import { monitoringConfig, monitoringEnabled } from "./config";

export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  // When adding real Sentry:
  // Sentry.init({ dsn: monitoringConfig.sentryDsn, environment: monitoringConfig.environment, release: monitoringConfig.release, tracesSampleRate: monitoringConfig.tracesSampleRate, beforeSend(event) { /* redact sensitive data */ return event; } });
  console.info("[monitoring] Sentry DSN configured. Install @sentry/react to activate.");
}

export function isMonitoringConfigured(): boolean {
  return monitoringEnabled;
}

export function setMonitoringUser(user?: { id: string; email?: string }): void {
  if (!monitoringEnabled || !user) return;
  // Sentry.setUser({ id: user.id, email: user.email });
}

export function clearMonitoringUser(): void {
  if (!monitoringEnabled) return;
  // Sentry.setUser(null);
}

export function setMonitoringRestaurantContext(context?: { restaurantId: string; restaurantName: string }): void {
  if (!monitoringEnabled || !context) return;
  // Sentry.setContext("restaurant", context);
}
