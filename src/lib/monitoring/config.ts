// Monitoring config — Build 2.7.
// Optional/config-driven. App works normally without monitoring env vars.

export const monitoringConfig = {
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ?? "",
  environment: import.meta.env.VITE_APP_ENV ?? "development",
  release: import.meta.env.VITE_APP_RELEASE ?? "unknown",
  tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? "",
};

export const monitoringEnabled = !!monitoringConfig.sentryDsn;
export const sentryDsnConfigured = !!monitoringConfig.sentryDsn;
