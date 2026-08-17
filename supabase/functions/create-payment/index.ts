import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import {
  PAYMOB_INTENTION_URL,
  parseIntegrationIds,
  buildCheckoutUrl,
  buildIntentionPayload,
} from "../_shared/paymob.ts";
import { initMonitoring, captureException } from "../_shared/monitoring.ts";

initMonitoring();

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function splitName(value: string | null | undefined) {
  const parts = (value || "MailCraft customer").trim().split(/\s+/);
  return { first_name: parts[0] || "MailCraft", last_name: parts.slice(1).join(" ") || "Customer" };
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const paymobSecretKey = requiredEnv("PAYMOB_SECRET_KEY");
    const paymobPublicKey = requiredEnv("PAYMOB_PUBLIC_KEY");
    const paymobIntegrationIds = parseIntegrationIds(Deno.env.get("PAYMOB_INTEGRATION_IDS"));
    if (!paymobIntegrationIds.length) throw new Error("PAYMOB_INTEGRATION_IDS must contain at least one integration ID");

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (authError || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as { planSlug?: string };
    const planSlug = typeof body.planSlug === "string" ? body.planSlug.trim() : "";
    if (!planSlug || planSlug === "free") return json({ error: "paid_plan_required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: plan, error: planError }, { data: profile }] = await Promise.all([
      admin.from("plans").select("id, slug, name_en, price_egp, paymob_amount_cents, monthly_quota").eq("slug", planSlug).eq("is_active", true).maybeSingle(),
      admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (planError || !plan || plan.paymob_amount_cents <= 0) return json({ error: "plan_unavailable" }, 400);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) return json({ error: "account_email_required" }, 400);

    const reference = `mailcraft_${userId}_${crypto.randomUUID()}`;
    const customer = { ...splitName(profile?.full_name), email: userData.user.email };
    const paymobResponse = await fetch(PAYMOB_INTENTION_URL, {
      method: "POST",
      headers: { Authorization: `Token ${paymobSecretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildIntentionPayload({
        amountCents: plan.paymob_amount_cents,
        planName: plan.name_en,
        integrationIds: paymobIntegrationIds,
        customer,
        reference,
        userId,
        planSlug: plan.slug,
        supabaseUrl,
        siteUrl: Deno.env.get("SITE_URL") || "https://ai-mailcraft.vercel.app",
      })),
    });
    const payment = await paymobResponse.json().catch(() => ({}));
    if (!paymobResponse.ok || !payment.client_secret) {
      console.error("Paymob intention failed", paymobResponse.status, payment);
      return json({ error: "payment_provider_error", paymob_status: paymobResponse.status, paymob_detail: payment }, 502);
    }

    const { error: subscriptionError } = await admin.from("subscriptions").upsert({
      user_id: userId,
      plan_id: plan.id,
      status: "pending",
      paymob_order_id: reference,
      current_period_start: null,
      current_period_end: null,
    }, { onConflict: "user_id" });
    if (subscriptionError) return json({ error: "subscription_setup_failed" }, 500);

    const baseUrl = Deno.env.get("PAYMOB_BASE_URL") || "https://accept.paymob.com";
    const checkoutUrl = buildCheckoutUrl(paymobPublicKey, payment.client_secret, baseUrl);
    return json({ checkoutUrl, plan: plan.slug });
  } catch (error) {
    console.error("create-payment failed", error);
    await captureException(error, { function: "create-payment", path: new URL(req.url).pathname });
    return json({ error: "payment_setup_failed" }, 500);
  }
}

if (import.meta.main) {
  serve(handler);
}
