import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { generateEmailIntelligence } from "../_shared/email-intelligence-service.ts";
import type { EmailGenerationRequest, EmailLanguage, EmailMode } from "../_shared/email-intelligence-types.ts";
import { initMonitoring, captureException } from "../_shared/monitoring.ts";

initMonitoring();

type RawBody = Partial<EmailGenerationRequest>;

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    const error = new Error(`Missing required secret: ${name}`);
    error.name = "ConfigurationError";
    throw error;
  }

  return value;
}

function monthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeRequest(body: RawBody): EmailGenerationRequest {
  return {
    ...body,
    mode: body.mode === "reply" ? "reply" as EmailMode : "compose" as EmailMode,
    language: body.language === "ar" ? "ar" as EmailLanguage : "en" as EmailLanguage,
  };
}

function validateRequest(input: EmailGenerationRequest) {
  if (input.refine && input.previousBody?.trim()) return null;
  if (input.mode === "compose" && !input.purpose?.trim()) return "missing_purpose";
  if (input.mode === "reply" && !input.incomingEmail?.trim()) return "missing_incoming";
  return null;
}

function cleanText(value: unknown, max = 4000) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replaceAll(String.fromCharCode(0), "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function sanitizeInput(input: EmailGenerationRequest): EmailGenerationRequest {
  const validWorkflows = ["client_proposal", "proposal_follow_up", "project_update", "payment_reminder", "revision_request", "client_complaint", "custom"];
  const workflow = validWorkflows.includes(input.workflow || "") ? input.workflow : "custom";
  const clientContext = input.clientContext ? {
    clientName: cleanText(input.clientContext.clientName, 200),
    company: cleanText(input.clientContext.company, 200),
    project: cleanText(input.clientContext.project, 300),
    service: cleanText(input.clientContext.service, 300),
    projectStatus: cleanText(input.clientContext.projectStatus, 500),
    paymentStatus: cleanText(input.clientContext.paymentStatus, 500),
    deadline: cleanText(input.clientContext.deadline, 120),
    amount: cleanText(input.clientContext.amount, 120),
    importantFacts: cleanText(input.clientContext.importantFacts, 2000),
    nextAction: cleanText(input.clientContext.nextAction, 500),
  } : undefined;
  return {
    ...input,
    senderRole: cleanText(input.senderRole, 300),
    recipientRole: cleanText(input.recipientRole, 300),
    purpose: cleanText(input.purpose, 1000),
    keyPoints: cleanText(input.keyPoints, 3000),
    incomingEmail: cleanText(input.incomingEmail, 6000),
    tone: cleanText(input.tone, 80),
    length: cleanText(input.length, 80),
    urgency: cleanText(input.urgency, 80),
    cta: cleanText(input.cta, 500),
    context: cleanText(input.context, 3000),
    avoid: cleanText(input.avoid, 1000),
    signature: cleanText(input.signature, 1000),
    template: cleanText(input.template, 120),
    englishVariant: input.englishVariant === "british" ? "british" : "american",
    previousSubject: cleanText(input.previousSubject, 500),
    previousBody: cleanText(input.previousBody, 6000),
    previousHistoryId: typeof input.previousHistoryId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.previousHistoryId)
      ? input.previousHistoryId
      : undefined,
    workflow,
    clientContext,
  };
}

function inputSnapshot(input: EmailGenerationRequest) {
  if (input.refine) {
    return {
      refine: input.refine,
      previousSubject: input.previousSubject,
      previousBody: input.previousBody,
    };
  }

  return {
    senderRole: input.senderRole,
    recipientRole: input.recipientRole,
    purpose: input.purpose,
    keyPoints: input.keyPoints,
    incomingEmail: input.incomingEmail,
    tone: input.tone,
    length: input.length,
    urgency: input.urgency,
    cta: input.cta,
    context: input.context,
    avoid: input.avoid,
    workflow: input.workflow,
    clientContext: input.clientContext,
  };
}

function historyInsertPayload(
  userId: string,
  input: EmailGenerationRequest,
  subject: string,
  body: string,
  intelligence: Awaited<ReturnType<typeof generateEmailIntelligence>>,
  includeIntelligenceFields = true,
  metadata: Record<string, unknown> | null = null,
) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    mode: input.mode,
    inputs: inputSnapshot(input),
    subject,
    body,
    language: input.language,
    tone: input.tone ?? intelligence.analysis.tone ?? null,
    workflow: input.workflow ?? "custom",
    client_context: input.clientContext ?? {},
    message_status: "draft",
    last_used_at: new Date().toISOString(),
  };

  if (includeIntelligenceFields) {
    payload.subject_lines = intelligence.subject_lines;
    payload.analysis = intelligence.analysis;
    payload.strategy = intelligence.strategy;
    payload.quality_score = intelligence.score;
    payload.analytics = intelligence.analytics;
  }

  if (metadata) Object.assign(payload, metadata);

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (authError || !userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    let input = sanitizeInput(normalizeRequest(await req.json() as RawBody));
    const validationError = validateRequest(input);
    if (validationError) return json({ error: validationError }, 400);

    const { data: rateLimitAllowed, error: rateLimitError } = await admin
      .rpc("check_generation_rate_limit", { p_user_id: userId, p_max_requests: 6, p_window_seconds: 60 });
    if (rateLimitError) {
      console.error("generation rate limit check failed", rateLimitError);
      return json({ error: "generation_failed", details: rateLimitError.message }, 500);
    }
    if (!rateLimitAllowed) return json({ error: "rate_limit" }, 429);

    let quota = 10;
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, current_period_end, plans(monthly_quota)")
      .eq("user_id", userId)
      .maybeSingle();

    const subActive =
      sub?.status === "active" &&
      (!sub?.current_period_end || new Date(sub.current_period_end) > new Date());
    if (subActive && sub?.plans?.monthly_quota) {
      quota = sub.plans.monthly_quota as number;
    } else {
      const { data: freePlan } = await admin
        .from("plans")
        .select("monthly_quota")
        .eq("slug", "free")
        .maybeSingle();
      if (freePlan?.monthly_quota != null) quota = freePlan.monthly_quota;
    }

    const period = monthStart();
    const { data: counter } = await admin
      .from("usage_counters")
      .select("id, emails_used")
      .eq("user_id", userId)
      .eq("period_start", period)
      .maybeSingle();
    const used = counter?.emails_used ?? 0;

    if (used >= quota) {
      return json({ error: "quota_exceeded", used, quota }, 403);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, default_role, default_signature, locale, job_title, company, company_website, industry, country, preferred_signature, default_tone, default_language, linkedin_url, phone_number, preferred_pronouns, timezone, preferred_greeting, default_cta, default_sign_off, main_service, professional_bio, portfolio_url, default_currency, common_services, default_payment_terms")
      .eq("user_id", userId)
      .maybeSingle();

    input = {
      ...input,
      senderRole: input.senderRole || profile?.job_title || profile?.default_role || undefined,
      tone: input.tone || profile?.default_tone || "formal",
      language: input.language || profile?.default_language || profile?.locale || "en",
      signature: input.signature || profile?.preferred_signature || profile?.default_signature || profile?.default_sign_off || undefined,
      cta: input.cta || profile?.default_cta || undefined,
      profile: {
        fullName: profile?.full_name ?? undefined,
        jobTitle: profile?.job_title ?? profile?.default_role ?? undefined,
        company: profile?.company ?? undefined,
        companyWebsite: profile?.company_website ?? undefined,
        industry: profile?.industry ?? undefined,
        country: profile?.country ?? undefined,
        preferredSignature: profile?.preferred_signature ?? profile?.default_signature ?? undefined,
        defaultTone: profile?.default_tone ?? undefined,
        defaultLanguage: profile?.default_language ?? profile?.locale ?? undefined,
        linkedInUrl: profile?.linkedin_url ?? undefined,
        phoneNumber: profile?.phone_number ?? undefined,
        preferredPronouns: profile?.preferred_pronouns ?? undefined,
        timeZone: profile?.timezone ?? undefined,
        preferredGreeting: profile?.preferred_greeting ?? undefined,
        defaultCta: profile?.default_cta ?? undefined,
        defaultSignOff: profile?.default_sign_off ?? undefined,
        mainService: profile?.main_service ?? undefined,
        professionalBio: profile?.professional_bio ?? undefined,
        portfolioUrl: profile?.portfolio_url ?? undefined,
        defaultCurrency: profile?.default_currency ?? undefined,
        commonServices: profile?.common_services ?? undefined,
        defaultPaymentTerms: profile?.default_payment_terms ?? undefined,
      },
    };

    const intelligence = await generateEmailIntelligence(input);
    const subject = intelligence.subject_lines[0] ?? "";
    const body = intelligence.email;

    let parentHistory: { id: string; generation_version: number; purpose: string | null } | null = null;
    if (input.refine && input.previousHistoryId) {
      const { data } = await admin
        .from("email_history")
        .select("id, generation_version, purpose")
        .eq("id", input.previousHistoryId)
        .eq("user_id", userId)
        .maybeSingle();
      parentHistory = data;
    }

    const historyMetadata = {
      parent_history_id: parentHistory?.id ?? null,
      generation_version: parentHistory ? parentHistory.generation_version + 1 : 1,
      revision_action: input.refine ?? null,
      template: input.template ?? null,
      purpose: input.purpose ?? parentHistory?.purpose ?? null,
      requested_length: input.length ?? null,
    };

    if (!input.refine) {
      if (counter?.id) {
        await admin
          .from("usage_counters")
          .update({ emails_used: used + 1 })
          .eq("id", counter.id);
      } else {
        await admin
          .from("usage_counters")
          .insert({ user_id: userId, period_start: period, emails_used: 1 });
      }
    }

    let { data: saved, error: saveError } = await admin
      .from("email_history")
      .insert(historyInsertPayload(userId, input, subject, body, intelligence, true, historyMetadata))
      .select("id")
      .maybeSingle();

    if (saveError) {
      console.error("email_history intelligence insert failed", saveError);
      const fallback = await admin
        .from("email_history")
        .insert(historyInsertPayload(userId, input, subject, body, intelligence, false))
        .select("id")
        .maybeSingle();

      saved = fallback.data;
      saveError = fallback.error;
    }

    if (saveError) {
      console.error("email_history fallback insert failed", saveError);
      return json({ error: "save_failed", details: saveError.message }, 500);
    }

    return json({
      analysis: intelligence.analysis,
      strategy: intelligence.strategy,
      subject_lines: intelligence.subject_lines,
      email: intelligence.email,
      score: intelligence.score,
      analytics: intelligence.analytics,
      grounding: intelligence.grounding,
      quality: intelligence.quality,
      readability: intelligence.readability,
      revision: intelligence.revision,
      validation: intelligence.validation,
      subject,
      body,
      id: saved?.id ?? null,
      history: { version: historyMetadata.generation_version, revision_action: historyMetadata.revision_action },
      usage: { used: input.refine ? used : used + 1, quota },
    });
  } catch (e) {
    console.error("generate-email error", e);
    if (!(e instanceof Error && e.name === "RateLimitError")) {
      await captureException(e, { function: "generate-email", path: new URL(req.url).pathname });
    }
    if (e instanceof Error && e.name === "RateLimitError") return json({ error: "rate_limit" }, 429);
    if (e instanceof Error && e.name === "BillingError") return json({ error: "credits_exhausted" }, 402);
    if (e instanceof Error && e.name === "ModelNotFoundError") {
      return json({ error: "ai_model_not_found", details: "The configured AI_MODEL is not available from the provider." }, 502);
    }
    if (e instanceof Error && e.name === "AiRequestError") {
      return json({ error: "ai_bad_request", details: "The AI provider rejected the request configuration." }, 502);
    }
    if (e instanceof Error && e.name === "ConfigurationError") {
      return json({ error: "server_not_configured", details: e.message }, 500);
    }
    if (e instanceof Error && e.message.includes("AI_API_KEY")) return json({ error: "ai_not_configured" }, 500);
    if (e instanceof Error && e.name === "AiProviderError") return json({ error: "ai_provider_error" }, 502);
    return json({
      error: "generation_failed",
      details: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    }, 500);
  }
});
