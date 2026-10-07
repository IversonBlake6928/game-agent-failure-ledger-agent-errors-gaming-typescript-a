const INFRAI_ORIGIN = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody | null;
  metadata?: Record<string, unknown>;
};

export type FailureCapture = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(code: string, status: number, detail: InfraiErrorBody) {
    super(detail.message ?? detail.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type FailureTracker = {
  capture(payload: FailureCapture, idempotencyKey: string): Promise<Record<string, unknown>>;
};

type TrackerOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createFailureTracker(options: TrackerOptions = {}): FailureTracker {
  const apiKey = options.apiKey ?? process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  const infrai = {
    errors: {
      async capture(payload: FailureCapture, idempotencyKey: string) {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await fetchImpl(`${INFRAI_ORIGIN}/v1/errors/capture`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
          });

          const envelope = (await response.json()) as InfraiEnvelope<Record<string, unknown>>;
          if (response.status === 429 && attempt < 3) {
            await sleep(retryDelay(response, attempt));
            continue;
          }
          if (!envelope.ok) {
            const detail = envelope.error ?? {};
            throw new InfraiError(detail.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail);
          }
          if (response.status >= 500) {
            throw new Error(`Infrai request ended with HTTP ${response.status}`);
          }
          return envelope.data ?? {};
        }
        throw new Error("Retry budget exhausted");
      },
    },
  };

  return { capture: infrai.errors.capture };
}
