import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

const hmacFields = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_void", "is_voided", "order", "owner", "pending", "source_data.pan", "source_data.sub_type",
  "source_data.type", "success",
];

function valueAt(obj: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

async function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let result = 0;
  for (let index = 0; index < leftBytes.length; index += 1) result |= leftBytes[index] ^ rightBytes[index];
  return result === 0;
}

async function calculateHmac(obj: Record<string, unknown>, secret: string) {
  const source = hmacFields.map((field) => {
    const value = field === "order" ? valueAt(obj, "order.id") : valueAt(obj, field);
    return asString(value);
  }).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    const obj = (body.obj && typeof body.obj === "object" ? body.obj : body) as Record<string, unknown>;
    const suppliedHmac = typeof body.hmac === "string" ? body.hmac : new URL(req.url).searchParams.get("hmac") || "";
    const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!hmacSecret) throw new Error("Missing required secret: PAYMOB_HMAC_SECRET");
    const expectedHmac = await calculateHmac(obj, hmacSecret);
    if (!suppliedHmac || !(await secureEqual(suppliedHmac, expectedHmac))) return json({ error: "invalid_signature" }, 401);

    const order = valueAt(obj, "order");
    const orderObject = order && typeof order === "object" ? order as Record<string, unknown> : undefined;
    const reference = [
      valueAt(obj, "merchant_order_id"), valueAt(obj, "special_reference"),
      orderObject && orderObject.merchant_order_id, orderObject && orderObject.special_reference,
    ].find((value) => typeof value === "string" && value.startsWith("mailcraft_")) as string | undefined;
    if (!reference) return json({ received: true });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const success = valueAt(obj, "success") === true;
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
    return json({ received: true });
  } catch (error) {
    console.error("paymob-webhook failed", error);
    return json({ error: "webhook_failed" }, 500);
  }
});
