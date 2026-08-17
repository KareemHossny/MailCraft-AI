type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

export class AiProviderError extends Error {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    super(`AI provider error: ${status}`);
    this.name = status === 400
      ? "AiRequestError"
      : status === 402
        ? "BillingError"
        : status === 404
          ? "ModelNotFoundError"
          : status === 429
            ? "RateLimitError"
            : "AiProviderError";
    this.status = status;
    this.details = details.slice(0, 600);
  }
}

function getAiConfig() {
  const apiKey = Deno.env.get("AI_API_KEY");
  if (!apiKey) throw new Error("AI_API_KEY is not configured");
  const model = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";
  const fallbackModels = (Deno.env.get("AI_FALLBACK_MODELS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== model);

  return {
    apiKey,
    baseUrl: Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1",
    model,
    fallbackModels,
    strictJson: Deno.env.get("AI_STRICT_JSON") === "true",
    appUrl: Deno.env.get("AI_APP_URL") ?? "http://localhost:8080",
    appName: Deno.env.get("AI_APP_NAME") ?? "MailCraft AI",
  };
}

export async function createJsonChatCompletion(messages: ChatMessage[], options: ChatOptions = {}) {
  const ai = getAiConfig();
  const isOpenRouter = ai.baseUrl.includes("openrouter.ai");
  const supportsStrictJson = ai.strictJson || !isOpenRouter;
  const models = [ai.model, ...ai.fallbackModels];
  let lastError: AiProviderError | null = null;

  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.maxTokens ?? 1600,
    };

    if (supportsStrictJson) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": ai.appUrl,
        "X-Title": ai.appName,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const detail = await response.text();
      lastError = new AiProviderError(response.status, detail);
      console.error("AI provider error", response.status, model, detail);

      if ([402, 404, 429].includes(response.status) && model !== models[models.length - 1]) {
        continue;
      }

      throw lastError;
    }

    const data = await response.json();
    return String(data.choices?.[0]?.message?.content ?? "");
  }

  throw lastError ?? new AiProviderError(502, "No AI models were available.");
}
