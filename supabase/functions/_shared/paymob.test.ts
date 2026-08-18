import {
  PAYMOB_INTENTION_URL,
  parseIntegrationIds,
  buildCheckoutUrl,
  buildIntentionPayload,
} from "./paymob.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("PAYMOB_INTENTION_URL targets v1/intention and has no trailing slash", () => {
  assertEquals(PAYMOB_INTENTION_URL, "https://accept.paymob.com/v1/intention");
  assertEquals(PAYMOB_INTENTION_URL.endsWith("/"), false);
});

Deno.test("parseIntegrationIds keeps only positive integers", () => {
  assertEquals(parseIntegrationIds("5212384"), [5212384]);
  assertEquals(parseIntegrationIds("5212384, 5263237"), [5212384, 5263237]);
  assertEquals(parseIntegrationIds("bad, 5212384, 0, -3, 12.5"), [5212384]);
  assertEquals(parseIntegrationIds(""), []);
  assertEquals(parseIntegrationIds(undefined), []);
  assertEquals(parseIntegrationIds(null), []);
});

Deno.test("buildIntentionPayload sends the configured integration IDs and EGP amount", () => {
  const payload = buildIntentionPayload({
    amountCents: 19900,
    planName: "Pro",
    integrationIds: [5212384],
    customer: { first_name: "John", last_name: "Doe", email: "john@example.com" },
    reference: "mailcraft_user_abc",
    userId: "user-abc",
    planSlug: "pro",
    supabaseUrl: "https://uwvschgthdsyevfhdtey.supabase.co",
    siteUrl: "https://ai-mailcraft.vercel.app",
  });

  assertEquals(payload.payment_methods, [5212384]);
  assertEquals(payload.amount, 19900);
  assertEquals(payload.currency, "EGP");
  assertEquals(payload.notification_url.endsWith("/functions/v1/paymob-webhook"), true);
  assertEquals(payload.redirection_url.includes("payment=pending"), true);
  assertEquals(payload.extras.user_id, "user-abc");
  assertEquals(payload.extras.plan_slug, "pro");
});

Deno.test("buildCheckoutUrl encodes keys and strips a trailing base slash", () => {
  const url = buildCheckoutUrl("pk_test", "secret123", "https://accept.paymob.com/");
  assertEquals(url.startsWith("https://accept.paymob.com/unifiedcheckout/?"), true);
  assertExists(url.match(/[?&]publicKey=pk_test/));
  assertExists(url.match(/[?&]clientSecret=secret123/));
});
