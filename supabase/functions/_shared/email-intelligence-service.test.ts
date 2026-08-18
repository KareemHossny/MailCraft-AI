import { generateEmailIntelligence } from "./email-intelligence-service.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";
import type { EmailGenerationRequest } from "./email-intelligence-types.ts";

function baseInput(): EmailGenerationRequest {
  return {
    mode: "compose",
    language: "en",
    purpose: "Follow up about the proposal",
    senderRole: "Freelancer",
    recipientRole: "Client",
    keyPoints: "Scope, timeline, next step",
  } as EmailGenerationRequest;
}

function stubFetch(body: unknown, status = 200) {
  return stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

Deno.test("generateEmailIntelligence falls back safely when the AI returns malformed JSON", async () => {
  Deno.env.set("AI_API_KEY", "test-key");
  const fetchStub = stubFetch({ foo: "bar" });
  try {
    const result = await generateEmailIntelligence(baseInput());
    assertExists(result.email);
    // Regression #3: analytics.indicators must always be a readable array.
    assertExists(result.analytics.indicators);
    assertEquals(Array.isArray(result.analytics.indicators), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("generateEmailIntelligence tolerates a response with analytics: null", async () => {
  Deno.env.set("AI_API_KEY", "test-key");
  const aiJson = JSON.stringify({
    analysis: {},
    strategy: {},
    subject_lines: ["Subject"],
    email: "Hello, following up on the proposal.",
    score: {},
    analytics: null,
  });
  const fetchStub = stubFetch({ choices: [{ message: { content: aiJson } }] });
  try {
    const result = await generateEmailIntelligence(baseInput());
    assertEquals(Array.isArray(result.analytics.indicators), true);
  } finally {
    fetchStub.restore();
  }
});
