// Safe logging utility — Build 2.7.
// Redacts sensitive values. Does not persist to localStorage.

const SENSITIVE_KEYS = new Set([
  "token", "access_token", "refresh_token", "authorization", "password",
  "secret", "service_role", "api_key", "stripe", "webhook", "supabase",
  "jwt", "invite_token", "session", "cookie",
]);

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return "[REDACTED]";
  for (const s of SENSITIVE_KEYS) {
    if (key.toLowerCase().includes(s)) return "[REDACTED]";
  }
  return value;
}

export function sanitizeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    safe[k] = typeof v === "object" && v !== null ? "[object]" : redactSensitiveValue(k, v);
  }
  return safe;
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.info(`[info] ${message}`, context ? sanitizeLogContext(context) : "");
  }
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  console.warn(`[warn] ${message}`, context ? sanitizeLogContext(context) : "");
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${msg}`, context ? sanitizeLogContext(context) : "");
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  logError(error, context);
  // If Sentry or monitoring provider is configured, forward here.
  // Sentry.captureException(error, { extra: sanitizeLogContext(context ?? {}) });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: Record<string, unknown>): void {
  if (level === "error") logError(message, context);
  else if (level === "warning") logWarn(message, context);
  else logInfo(message, context);
}
