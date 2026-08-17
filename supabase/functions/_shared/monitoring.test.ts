import { initMonitoring, captureException } from "./monitoring.ts";
import { assertEquals } from "https://deno.land/std@0.168.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";

Deno.test("captureException is a no-op and never throws when SENTRY_DSN is unset", async () => {
  Deno.env.delete("SENTRY_DSN");
  initMonitoring();
  let threw = false;
  try {
    await captureException(new Error("boom"));
  } catch {
    threw = true;
  }
  assertEquals(threw, false);
});

Deno.test("captureException sends a Sentry envelope when SENTRY_DSN is configured", async () => {
  Deno.env.set("SENTRY_DSN", "https://abc123@o1.ingest.sentry.io/42");
  initMonitoring();

  let sentUrl = "";
  let sentAuth = "";
  let sentBody = "";
  const fetchStub = stub(
    globalThis,
    "fetch",
    (url: string | URL | Request, init?: RequestInit) => {
      sentUrl = String(url);
      sentAuth = ((init?.headers as Record<string, string> | undefined)?.["X-Sentry-Auth"]) ?? "";
      sentBody = typeof init?.body === "string" ? init.body : "";
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  );

  try {
    await captureException(new Error("kaboom"), { function: "test" });
    assertEquals(sentUrl.includes("/api/42/envelope/"), true);
    assertEquals(sentAuth.includes("sentry_key=abc123"), true);
    assertEquals(sentBody.includes("kaboom"), true);
    assertEquals(sentBody.includes('"function":"test"'), true);
  } finally {
    fetchStub.restore();
  }
});
