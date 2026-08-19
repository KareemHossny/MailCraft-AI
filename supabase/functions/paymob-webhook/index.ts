import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { initMonitoring, captureException } from "../_shared/monitoring.ts";

initMonitoring();

// Ordered field list Paymob uses to compute the Transaction Processed callback
// HMAC: HMAC-SHA512 over the fields concatenated with no separator, lowercase hex.
// This is the canonical list for the Accept transaction webhook, which is exactly
// what the Unified Checkout / Intention API delivers to notification_url.
const hmacFields = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order", "owner", "pending", "source_data.pan", "source_data.sub_type",
  "source_data.type", "success",
];

export function valueAt(obj: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export async function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let result = 0;
  for (let index = 0; index < leftBytes.length; index += 1) result |= leftBytes[index] ^ rightBytes[index];
  return result === 0;
}

export async function calculateHmac(obj: Record<string, unknown>, secret: string) {
  const source = hmacFields.map((field) => {
    const value = field === "order" ? valueAt(obj, "order.id") : valueAt(obj, field);
    return asString(value);
  }).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Paymob may nest the transaction under `obj` (standard Accept callback) or under
// `transaction` (Intention-shaped payload). Resolve whichever is present.
export function findTransactionObject(body: Record<string, unknown>): Record<string, unknown> {
  for (const candidate of [body.obj, body.transaction]) {
    if (candidate && typeof candidate === "object") return candidate as Record<string, unknown>;
  }
  return body;
}

export function extractReference(transaction: Record<string, unknown>): string | undefined {
  const order = transaction.order && typeof transaction.order === "object" ? transaction.order as Record<string, unknown> : undefined;
  return [
    transaction.merchant_order_id,
    transaction.special_reference,
    order?.merchant_order_id,
    order?.special_reference,
  ].find((value) => typeof value === "string" && (value as string).startsWith("mailcraft_")) as string | undefined;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    const transaction = findTransactionObject(body);

    console.log("[paymob-webhook] payload keys", Object.keys(body), "transaction keys", Object.keys(transaction));

    const suppliedHmac = typeof body.hmac === "string" ? body.hmac : new URL(req.url).searchParams.get("hmac") || "";
    const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!hmacSecret) {
      console.error("[paymob-webhook] PAYMOB_HMAC_SECRET is not set");
      return json({ error: "server_misconfigured" }, 500);
    }

    const expectedHmac = await calculateHmac(transaction, hmacSecret);
    if (!suppliedHmac || !(await secureEqual(suppliedHmac, expectedHmac))) {
      console.error("[paymob-webhook] HMAC mismatch", { supplied: suppliedHmac.slice(0, 8), expected: expectedHmac.slice(0, 8) });
      return json({ error: "invalid_signature" }, 401);
    }

    const reference = extractReference(transaction);
    if (!reference) return json({ received: true });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const success = transaction.success === true;
    const { data: pending } = await admin.from("subscriptions").select("user_id, plan_id, paymob_order_id").eq("paymob_order_id", reference).maybeSingle();
    if (!pending) return json({ received: true });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    await admin.from("subscriptions").update({
      status: success ? "active" : "inactive",
      current_period_start: success ? now.toISOString() : null,
      current_period_end: success ? periodEnd.toISOString() : null,
    }).eq("paymob_order_id", reference);
    console.log("[paymob-webhook] subscription updated", { reference, success });
    return json({ received: true });
  } catch (error) {
    console.error("paymob-webhook failed", error);
    await captureException(error, { function: "paymob-webhook", path: new URL(req.url).pathname });
    return json({ error: "webhook_failed" }, 500);
  }
};

if (import.meta.main) {
  serve(handler);
}
