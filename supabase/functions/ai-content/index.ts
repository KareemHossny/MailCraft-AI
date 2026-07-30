import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createJsonChatCompletion } from "../_shared/ai-provider.ts";
import { corsHeaders, json } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { sectionTitle, sectionContent, templateCategory, proposalTitle } = await req.json();
    const systemPrompt = `You are an expert business proposal editor.
Improve proposal section content so it is professional, persuasive, specific, and clear.

Rules:
- Keep the same meaning and do not invent facts.
- Remove filler, buzzwords, and vague claims.
- Preserve useful details from the original.
- Return only the improved section content as JSON: {"content": "..."}`;

    const raw = await createJsonChatCompletion([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          templateCategory: templateCategory || "general",
          proposalTitle: proposalTitle || "Untitled",
          sectionTitle: sectionTitle || "Untitled Section",
          sectionContent: sectionContent || "Write initial content for this section.",
        }),
      },
    ]);

    let content = "";
    try {
      const parsed = JSON.parse(raw);
      content = String(parsed.content ?? "").trim();
    } catch {
      content = raw.trim();
    }

    if (!content) return json({ error: "AI service returned empty content" }, 502);
    return json({ content });
  } catch (e) {
    console.error("ai-content error:", e);
    if (e instanceof Error && e.name === "RateLimitError") return json({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
    if (e instanceof Error && e.name === "BillingError") return json({ error: "AI credits exhausted. Check your AI provider billing settings." }, 402);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
