/**
 * Server-only Kundivent adapter.
 *
 * The integration secret and the target origin never leave this module: they
 * are read from backend configuration inside each call, attached as headers,
 * and never logged, returned or embedded in URLs. Redirects are refused so no
 * credential can be forwarded to another origin.
 */
import {
  CONTRACT_VERSION,
  MasterDataSchema,
  ReceiptSchema,
  SOURCE_SYSTEM_DEFAULT,
  TargetEventListSchema,
  TargetEventSchema,
  type MasterData,
  type Receipt,
  type TargetEvent,
  type TargetEventList,
} from "@/lib/kundivent-contract";

export type KundiventConfig = { origin: string; key: string; sourceSystem: string };

export class KundiventError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = "KundiventError";
    this.code = code;
    this.status = status;
  }
}

/** Resolves backend configuration. Returns null when the integration is unconfigured. */
export function readConfig(): KundiventConfig | null {
  const rawBase = process.env["KUNDIVENT_BASE_URL"];
  const key = process.env["KUNDICALC_INTEGRATION_KEY"];
  if (!rawBase || !key || key.length < 24) return null;
  let url: URL;
  try {
    url = new URL(rawBase);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return {
    origin: url.origin,
    key,
    sourceSystem: process.env["KUNDICALC_SOURCE_SYSTEM"] || SOURCE_SYSTEM_DEFAULT,
  };
}

export function requireConfig(): KundiventConfig {
  const cfg = readConfig();
  if (!cfg) throw new KundiventError("integration_not_configured", 503);
  return cfg;
}

/** True when the URL points at the configured, trusted Kundivent origin. */
export function isTrustedTargetUrl(value: string, cfg: KundiventConfig): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.origin === cfg.origin;
  } catch {
    return false;
  }
}

const BASE_PATH = "/api/public/integrations/kundicalc/v1";

type CallOptions = { method: "GET" | "POST"; path: string; body?: unknown; actorId: string; timeoutMs?: number };

/** Performed only from the server. Never follows redirects (no credential leaks). */
async function call(cfg: KundiventConfig, opts: CallOptions): Promise<unknown> {
  const url = `${cfg.origin}${BASE_PATH}${opts.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-kundicalc-key": cfg.key,
        "x-kundicalc-actor": opts.actorId,
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new KundiventError(aborted ? "timeout" : "network_error", 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new KundiventError("network_error", response.status);
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code =
      (payload as { error?: { code?: string } } | null)?.error?.code ??
      (response.status === 401 ? "invalid_credentials" : response.status === 503 ? "integration_not_configured" : "unexpected");
    throw new KundiventError(code, response.status);
  }
  return payload;
}

function assertVersion(version: string | undefined) {
  if (version !== CONTRACT_VERSION) throw new KundiventError("unexpected", 200);
}

export async function getMasterData(cfg: KundiventConfig, actorId: string): Promise<MasterData> {
  const parsed = MasterDataSchema.safeParse(await call(cfg, { method: "GET", path: "/master-data", actorId }));
  if (!parsed.success) throw new KundiventError("unexpected", 200);
  assertVersion(parsed.data.contract_version);
  return parsed.data;
}

export async function searchEvents(
  cfg: KundiventConfig,
  actorId: string,
  params: { q?: string; from?: string; to?: string; status?: string; limit: number; offset: number },
): Promise<TargetEventList> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.status) search.set("status", params.status);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  const parsed = TargetEventListSchema.safeParse(
    await call(cfg, { method: "GET", path: `/events?${search.toString()}`, actorId }),
  );
  if (!parsed.success) throw new KundiventError("unexpected", 200);
  assertVersion(parsed.data.contract_version);
  return parsed.data;
}

export async function getEvent(cfg: KundiventConfig, actorId: string, eventId: string): Promise<TargetEvent> {
  const raw = (await call(cfg, {
    method: "GET",
    path: `/events/${encodeURIComponent(eventId)}`,
    actorId,
  })) as Record<string, unknown> | null;
  // The receiver may return the event directly or wrapped in { event: ... }.
  const candidate = raw && typeof raw === "object" && "event" in raw ? (raw as { event: unknown }).event : raw;
  const parsed = TargetEventSchema.safeParse(candidate);
  if (!parsed.success) throw new KundiventError("unexpected", 200);
  return parsed.data;
}

export async function postHandover(cfg: KundiventConfig, actorId: string, body: unknown): Promise<Receipt> {
  const parsed = ReceiptSchema.safeParse(await call(cfg, { method: "POST", path: "/handover", body, actorId, timeoutMs: 30000 }));
  if (!parsed.success) throw new KundiventError("unexpected", 200);
  assertVersion(parsed.data.contract_version);
  return parsed.data;
}

export async function getReceipt(cfg: KundiventConfig, actorId: string, sourceEventId: string): Promise<Receipt | null> {
  try {
    const parsed = ReceiptSchema.safeParse(
      await call(cfg, { method: "GET", path: `/receipts/${encodeURIComponent(sourceEventId)}`, actorId }),
    );
    if (!parsed.success) throw new KundiventError("unexpected", 200);
    assertVersion(parsed.data.contract_version);
    return parsed.data;
  } catch (error) {
    if (error instanceof KundiventError && (error.code === "not_found" || error.status === 404)) return null;
    throw error;
  }
}
