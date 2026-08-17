type SentryDsn = {
  publicKey: string;
  host: string;
  projectId: string;
};

let configured = false;
let dsn: SentryDsn | null = null;
let environment = "production";
let release = "";

function parseDsn(raw: string | undefined | null): SentryDsn | null {
  if (!raw) return null;
  const match = raw.match(/^https:\/\/([0-9a-f]+)@([^/]+)\/(\d+)$/i);
  if (!match) return null;
  return { publicKey: match[1], host: match[2], projectId: match[3] };
}

export function initMonitoring(opts?: { environment?: string; release?: string }) {
  dsn = parseDsn(Deno.env.get("SENTRY_DSN"));
  environment = opts?.environment ?? Deno.env.get("SENTRY_ENVIRONMENT") ?? "production";
  release = opts?.release ?? Deno.env.get("SENTRY_RELEASE") ?? "";

  if (configured) return;
  configured = true;
  if (!dsn) return; // Monitoring disabled until SENTRY_DSN is configured.

  const globalScope = globalThis as unknown as {
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  };
  if (typeof globalScope.addEventListener === "function") {
    globalScope.addEventListener("unhandledrejection", (event) => {
      const reason = (event as { reason?: unknown })?.reason ?? event;
      captureException(reason, { source: "unhandledrejection" });
    });
    globalScope.addEventListener("error", (event) => {
      const error = (event as { error?: unknown })?.error ?? event;
      captureException(error, { source: "error" });
    });
  }
}

function newEventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : JSON.stringify(value));
}

function buildEvent(error: unknown, extra?: Record<string, unknown>) {
  const err = toError(error);
  const event: Record<string, unknown> = {
    event_id: newEventId(),
    timestamp: new Date().toISOString(),
    platform: "deno",
    level: "error",
    environment,
    sdk: { name: "mailcraft-edge", version: "1.0.0" },
    message: `${err.name}: ${err.message}`,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: { frames: [] },
        },
      ],
    },
    extra: { ...extra, stack: err.stack },
  };
  if (release) event.release = release;
  return event;
}

async function sendEnvelope(event: Record<string, unknown>) {
  if (!dsn) return;
  const endpoint = `https://${dsn.host}/api/${dsn.projectId}/envelope/`;
  const header = { event_id: event.event_id, sent_at: new Date().toISOString() };
  const itemHeader = {
    type: "event",
    content_type: "application/json",
    length: JSON.stringify(event).length,
  };
  const body = `${JSON.stringify(header)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}\n`;

  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth":
        `Sentry sentry_key=${dsn.publicKey}, sentry_version=7, sentry_client=mailcraft-edge/1.0.0`,
    },
    body,
    signal: AbortSignal.timeout(3000),
  });
}

export async function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!dsn) return; // No-op when SENTRY_DSN is not configured.
  try {
    await sendEnvelope(buildEvent(error, extra));
  } catch {
    // Monitoring must never break the application.
  }
}
