import { createJsonChatCompletion } from "./ai-provider.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";

function withAiKey() {
  Deno.env.set("AI_API_KEY", "test-key");
}

Deno.test("createJsonChatCompletion returns content on a successful response", async () => {
  withAiKey();
  const fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"email":"hi"}' } }] }), {
          status: 200,
        }),
      ),
  );
  try {
    const content = await createJsonChatCompletion([{ role: "user", content: "hi" }]);
    assertEquals(content, '{"email":"hi"}');
  } finally {
    fetchStub.restore();
  }
});

Deno.test(
  "createJsonChatCompletion aborts on timeout instead of hanging",
  async () => {
    withAiKey();
    // Force AbortSignal.timeout to abort immediately so the test stays fast.
    const timeoutStub = stub(AbortSignal, "timeout", () => AbortSignal.abort(new Error("timeout")));

    let receivedSignal: AbortSignal | undefined;
    const fetchStub = stub(
      globalThis,
      "fetch",
      (_url: string, init?: RequestInit) => {
        receivedSignal = init?.signal as AbortSignal | undefined;
        if (receivedSignal?.aborted) {
          return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
        }
        // If no abort signal were passed, this would never resolve and the request would hang.
        return new Promise<Response>(() => {});
      },
    );

    const start = Date.now();
    let error: unknown;
    try {
      await createJsonChatCompletion([{ role: "user", content: "hi" }]);
    } catch (e) {
      error = e;
    } finally {
      timeoutStub.restore();
      fetchStub.restore();
    }

    assertExists(error, "request must reject when aborted");
    assertEquals(receivedSignal?.aborted, true);
    assertEquals(Date.now() - start < 5000, true);
  },
  { timeout: 4000 },
);
