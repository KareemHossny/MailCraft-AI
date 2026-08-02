import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import { Link } from "react-router-dom";
import {
  ClipboardCheck, Copy, Download, FileText, Loader2, RefreshCw, ShieldCheck,
  Sparkles, TriangleAlert, Wand2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/services/supabase/client";
import { toast } from "sonner";
import type { TranslationKey } from "@/i18n/translations";

type Mode = "compose" | "reply";
type CommunicationWorkflow = "client_proposal" | "proposal_follow_up" | "project_update" | "payment_reminder" | "revision_request" | "client_complaint" | "custom";
type Refinement = "shorter" | "longer" | "formal" | "casual" | "executive" | "persuasive" | "concise" | "recruiter" | "investor" | "sales" | "british" | "american" | "friendlier" | "warmer" | "confident" | "simpler_english" | "more_natural" | "follow_up" | "direct" | "polite" | "ats_friendly" | "ceo" | "sales_pitch" | "customer_support" | "networking";
type Snippet = { id: string; title: string; body: string };
type ClientContext = { clientName: string; company: string; project: string; service: string; projectStatus: string; paymentStatus: string; deadline: string; amount: string; importantFacts: string; nextAction: string };
type IntelligenceResult = {
  analysis: { intent: string; tone: string; hooks: string[]; pain_points: string[] };
  strategy?: { summary?: string; personalization_used?: string[]; why_it_should_work?: string[]; next_best_action?: string; tone?: string; goal?: string; audience?: string; primary_cta?: string; writing_style?: string; facts_used?: number; estimated_reading_time_seconds?: number };
  analytics?: { readability?: number; cta_strength?: number; spam_risk?: number; response_likelihood?: number; indicators?: string[] };
  grounding?: {
    confidence: number;
    status: "grounded" | "review";
    sources: Array<{ label: string; detail: string }>;
    ignored_categories: string[];
    potential_claims: Array<{ text: string; reason: string; recommendation: string }>;
  };
  quality?: {
    overall: number;
    dimensions: Array<{ key: string; label: string; score: number; reasons: string[]; suggestion?: string }>;
  };
  readability?: { word_count: number; reading_time_seconds: number; reading_level: "Simple" | "Business" | "Advanced"; paragraphs: number; average_sentence_length: number };
  revision?: { changes: string[] };
  validation?: { attempts: number; regenerated: boolean; status: "passed" | "fallback_used"; unsupported_claims_removed: string[] };
  subject_lines: string[];
  email: string;
  score: { personalization: number; clarity: number; persuasion: number; overall: number };
  subject: string;
  body: string;
  historyId?: string;
};

const templates = [
  { id: "cold-outreach", category: "Sales", title: "Cold outreach", purpose: "Start a relevant conversation with a prospect.", tone: "sales", cta: "Would a short call next week be useful?" },
  { id: "follow-up", category: "Sales", title: "Follow-up", purpose: "Follow up politely after a previous message.", tone: "friendly", cta: "Would you be open to a quick reply?" },
  { id: "partnership", category: "Sales", title: "Partnership", purpose: "Propose a mutually useful partnership.", tone: "persuasive", cta: "Could we explore this in a brief call?" },
  { id: "job-application", category: "Career", title: "Job application", purpose: "Introduce yourself for a role and explain your relevant fit.", tone: "formal", cta: "I would welcome the chance to discuss my application." },
  { id: "recruiter-reply", category: "Career", title: "Recruiter reply", purpose: "Reply to a recruiter with clear interest and availability.", tone: "recruiter", cta: "Please let me know a suitable time to speak." },
  { id: "application-follow-up", category: "Career", title: "Application follow-up", purpose: "Follow up on a job application with a concise, respectful update request.", tone: "formal", cta: "I would appreciate any update you can share on the application process." },
  { id: "interview-thank-you", category: "Career", title: "Interview thank-you", purpose: "Thank an interviewer and reinforce your interest using only details from the conversation.", tone: "friendly", cta: "I would be glad to provide any further information." },
  { id: "freelance-proposal", category: "Freelance", title: "Freelance proposal", purpose: "Respond to a project brief with a clear fit, approach, and next step.", tone: "persuasive", cta: "Would you be open to a brief call to discuss the project?" },
  { id: "client-follow-up", category: "Freelance", title: "Client follow-up", purpose: "Follow up with a prospective client after an initial conversation or proposal.", tone: "friendly", cta: "I would be happy to answer any questions or discuss the next step." },
  { id: "scope-clarification", category: "Freelance", title: "Scope clarification", purpose: "Ask focused questions about project scope, deliverables, timeline, or requirements.", tone: "professional", cta: "Could you confirm these details so I can prepare an accurate proposal?" },
  { id: "payment-reminder", category: "Freelance", title: "Payment reminder", purpose: "Send a firm but respectful reminder about an outstanding freelance payment.", tone: "firm", cta: "Could you please confirm when the payment is expected?" },
  { id: "support-response", category: "Support", title: "Support response", purpose: "Resolve a customer issue clearly and respectfully.", tone: "friendly", cta: "Please reply if there is anything else we can help with." },
  { id: "executive-update", category: "Executive", title: "Executive update", purpose: "Share a concise decision-ready business update.", tone: "executive", cta: "Please confirm the preferred next step." },
  { id: "investor-intro", category: "Executive", title: "Investor introduction", purpose: "Make a focused introduction to a potential investor.", tone: "investor", cta: "Would you be open to a short introductory conversation?" },
];

const workflows: Array<{ id: CommunicationWorkflow; labelKey: TranslationKey; purpose: string; tone: string; cta: string }> = [
  { id: "client_proposal", labelKey: "gen.workflow.client_proposal", purpose: "Present my service and approach for this client's project.", tone: "persuasive", cta: "Would you be open to a brief call to discuss the project?" },
  { id: "proposal_follow_up", labelKey: "gen.workflow.proposal_follow_up", purpose: "Follow up on the proposal I sent and ask about the next step.", tone: "friendly", cta: "Would you be open to sharing an update?" },
  { id: "project_update", labelKey: "gen.workflow.project_update", purpose: "Share a clear update on the current project status.", tone: "formal", cta: "Please let me know if you have any questions about the next step." },
  { id: "payment_reminder", labelKey: "gen.workflow.payment_reminder", purpose: "Send a respectful reminder about an outstanding project payment.", tone: "firm", cta: "Could you please confirm when the payment is expected?" },
  { id: "revision_request", labelKey: "gen.workflow.revision_request", purpose: "Respond constructively to the client's requested revisions.", tone: "friendly", cta: "Could you confirm the priority changes so I can proceed?" },
  { id: "client_complaint", labelKey: "gen.workflow.client_complaint", purpose: "Respond calmly to the client's concern and propose the next step.", tone: "apologetic", cta: "Could we agree on the next step to resolve this?" },
  { id: "custom", labelKey: "gen.workflow.custom", purpose: "Write a professional client message.", tone: "formal", cta: "What would be the best next step?" },
];

export default function Generate() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("compose");
  const [form, setForm] = useState({
    senderRole: "", recipientRole: "", purpose: "Present my service and approach for this client's project.", keyPoints: "", incomingEmail: "",
    tone: "persuasive", length: "medium", urgency: "normal", cta: "Would you be open to a brief call to discuss the project?", context: "", avoid: "",
  });
  const [workflow, setWorkflow] = useState<CommunicationWorkflow>("client_proposal");
  const [clientContext, setClientContext] = useState<ClientContext>({ clientName: "", company: "", project: "", service: "", projectStatus: "", paymentStatus: "", deadline: "", amount: "", importantFacts: "", nextAction: "" });
  const [language, setLanguage] = useState<"en" | "ar">(locale);
  const [englishVariant, setEnglishVariant] = useState<"american" | "british">("american");
  const [signature, setSignature] = useState("");
  const [exportAuthor, setExportAuthor] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("custom");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [activeRefinement, setActiveRefinement] = useState<Refinement | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const generatingRef = useRef(false);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setClient = (key: keyof ClientContext, value: string) => setClientContext((current) => ({ ...current, [key]: value }));

  const loadUsage = useCallback(async () => {
    if (!user) return;
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01`;
    const [{ data: counter }, { data: subscription }] = await Promise.all([
      supabase.from("usage_counters").select("emails_used").eq("user_id", user.id).eq("period_start", period).maybeSingle(),
      supabase.from("subscriptions").select("status, plans(monthly_quota)").eq("user_id", user.id).maybeSingle(),
    ]);
    let quota = 10;
    if (subscription?.status === "active" && subscription.plans?.monthly_quota) quota = subscription.plans.monthly_quota;
    else {
      const { data: freePlan } = await supabase.from("plans").select("monthly_quota").eq("slug", "free").maybeSingle();
      if (freePlan?.monthly_quota != null) quota = freePlan.monthly_quota;
    }
    setUsage({ used: counter?.emails_used ?? 0, quota });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setOnboardingDismissed(window.localStorage.getItem(`mailcraft:onboarding-dismissed:${user.id}`) === "true");
    const loadWorkspace = async () => {
      const [{ data: profile }, { data: savedSnippets }] = await Promise.all([
        supabase.from("profiles").select("full_name, default_role, default_signature, locale, job_title, preferred_signature, default_tone, default_language, default_cta, default_sign_off, main_service").eq("user_id", user.id).maybeSingle(),
        supabase.from("snippets").select("id, title, body").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (profile) {
        if (profile.job_title || profile.default_role) setForm((current) => ({ ...current, senderRole: profile.job_title || profile.default_role || "" }));
        if (profile.preferred_signature || profile.default_signature || profile.default_sign_off) setSignature(profile.preferred_signature || profile.default_signature || profile.default_sign_off || "");
        if (profile.default_tone) setForm((current) => ({ ...current, tone: profile.default_tone }));
        if (profile.default_cta) setForm((current) => ({ ...current, cta: current.cta || profile.default_cta }));
        if (profile.main_service) setClientContext((current) => ({ ...current, service: profile.main_service || "" }));
        if (profile.full_name) setExportAuthor(profile.full_name);
        if (profile.default_language === "ar" || profile.default_language === "en") setLanguage(profile.default_language);
        else if (profile.locale === "ar" || profile.locale === "en") setLanguage(profile.locale);
      }
      setSnippets(savedSnippets ?? []);
    };
    void loadWorkspace();
    void loadUsage();
  }, [loadUsage, user]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "Enter") { event.preventDefault(); void generate(); }
      if (event.shiftKey && event.key.toLowerCase() === "c" && result) { event.preventDefault(); copyAll(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setForm((current) => ({ ...current, purpose: template.purpose, tone: template.tone, cta: template.cta }));
  };

  const applyWorkflow = (value: CommunicationWorkflow) => {
    setWorkflow(value);
    const selected = workflows.find((item) => item.id === value) ?? workflows[workflows.length - 1];
    setForm((current) => ({ ...current, purpose: selected.purpose, tone: selected.tone, cta: selected.cta }));
    setSelectedTemplate("custom");
  };

  const dismissOnboarding = () => {
    if (user) window.localStorage.setItem(`mailcraft:onboarding-dismissed:${user.id}`, "true");
    setOnboardingDismissed(true);
  };

  const showOnboarding = Boolean(user && !onboardingDismissed && !form.senderRole.trim() && !form.purpose.trim() && selectedTemplate === "custom");

  const insertSnippet = (id: string) => {
    const snippet = snippets.find((item) => item.id === id);
    if (!snippet) return;
    set("keyPoints", `${form.keyPoints}${form.keyPoints ? "\n" : ""}${snippet.body}`);
    toast.success("Snippet added to key points.");
  };

  const readFunctionError = async (error: unknown) => {
    const context = (error as { context?: Response })?.context;
    if (!context) return null;
    try { return await context.clone().json() as { error?: string; details?: string }; } catch { return null; }
  };

  const handleError = (error: { message?: string } | null, data: { error?: string; details?: string } | null) => {
    const code = data?.error || error?.message || "";
    if (data?.details) console.error("Generate function details:", data.details);
    if (code === "quota_exceeded") { setQuotaHit(true); return true; }
    const messages: Record<string, string> = {
      rate_limit: "Rate limit reached. Please wait a moment.", credits_exhausted: "AI credits are exhausted.",
      ai_not_configured: "AI provider is not configured in Supabase secrets.", server_not_configured: "Supabase function secrets are incomplete.",
      ai_model_not_found: "The selected AI model is unavailable. Update AI_MODEL.", ai_bad_request: "AI request settings were rejected.",
      ai_provider_error: "AI provider rejected the request. Check model and API key settings.", save_failed: "The generated email could not be saved.",
      generation_failed: "Generation failed. Check the function logs.",
    };
    if (messages[code]) { toast.error(messages[code]); return true; }
    if (code.startsWith("missing")) { toast.error(t("gen.required")); return true; }
    if (code) { toast.error(t("gen.error")); return true; }
    return false;
  };

  const generate = async (refine?: Refinement) => {
    if (generatingRef.current) return;
    if (!refine && ((mode === "compose" && !form.purpose.trim()) || (mode === "reply" && !form.incomingEmail.trim()))) {
      toast.error(t("gen.required"));
      return;
    }
    generatingRef.current = true;
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("generate-email", {
        body: {
          mode, language, englishVariant, signature, template: selectedTemplate === "custom" ? undefined : selectedTemplate,
          workflow, clientContext, ...form, ...(refine ? { refine, previousSubject: result?.subject, previousBody: result?.body, previousHistoryId: result?.historyId } : {}),
        },
      });
      const { error } = response;
      let { data } = response;
      if (error && !data) data = await readFunctionError(error);
      if (handleError(error, data)) return;
      if (data?.body || data?.email) {
        const body = data.body ?? data.email;
        const subjectLines = Array.isArray(data.subject_lines) ? data.subject_lines : [data.subject ?? ""].filter(Boolean);
        setResult({
          analysis: data.analysis ?? { intent: "", tone: "", hooks: [], pain_points: [] }, strategy: data.strategy,
          analytics: data.analytics, grounding: data.grounding, quality: data.quality, readability: data.readability, revision: data.revision, validation: data.validation, subject_lines: subjectLines, email: data.email ?? body,
          score: data.score ?? { personalization: 0, clarity: 0, persuasion: 0, overall: 0 }, subject: data.subject ?? subjectLines[0] ?? "", body,
          historyId: data.id ?? undefined,
        });
        setActiveRefinement(refine ?? null);
        if (data.usage) setUsage(data.usage);
        if (!refine) toast.success(t("gen.saved"));
      }
    } finally {
      generatingRef.current = false;
      setLoading(false);
    }
  };

  const copy = async (text: string, message = t("common.copied")) => {
    try { await navigator.clipboard.writeText(text); toast.success(message); }
    catch { toast.error("Copy failed. Please select the text manually."); }
  };
  const copyAll = () => result && void copy(`Subject: ${result.subject}\n\n${result.body}`, "Email copied.");
  const downloadBlob = (content: BlobPart, type: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  };
  const exportPdf = () => {
    if (!result) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    pdf.setCharSpace(0);
    const margin = 54;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const author = exportAuthor || "MailCraft";
    pdf.setProperties({ title: result.subject || "MailCraft email", author, subject: "Email draft generated with MailCraft" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text("MAILCRAFT EMAIL DRAFT", margin, margin);
    pdf.setDrawColor(210, 210, 210);
    pdf.line(margin, margin + 10, pageWidth - margin, margin + 10);
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(17);
    const subjectLines = wrapPdfText(pdf, result.subject, contentWidth);
    subjectLines.forEach((line, index) => pdf.text(line, margin, margin + 38 + index * 22));
    let y = margin + 66;
    if (subjectLines.length > 1) y += (subjectLines.length - 1) * 22;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const writeLine = (line: string) => {
      const urlOnly = line.trim().match(/^https?:\/\/\S+$/)?.[0];
      const lines = wrapPdfText(pdf, line || " ", contentWidth);
      for (const wrapped of lines) {
        if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
        if (urlOnly && wrapped === urlOnly) {
          pdf.setTextColor(36, 99, 235);
          pdf.textWithLink(wrapped, margin, y, { url: urlOnly });
          pdf.setTextColor(30, 30, 30);
        } else pdf.text(wrapped, margin, y);
        y += 17;
      }
      y += 4;
    };
    result.body.split(/\r?\n/).forEach(writeLine);
    pdf.save(exportFileName(result.subject, "pdf"));
  };
  const exportDocx = async () => {
    if (!result) return;
    const document = new Document({
      creator: exportAuthor || "MailCraft",
      title: result.subject || "MailCraft email",
      description: "Email draft generated with MailCraft",
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: "MAILCRAFT EMAIL DRAFT", size: 16, color: "6B7280" })], spacing: { after: 180 } }),
          new Paragraph({ children: [new TextRun({ text: result.subject, bold: true, size: 30, color: "1F2937" })], spacing: { after: 280 } }),
          ...result.body.split(/\r?\n/).map((line) => emailParagraph(line)),
        ],
      }],
    });
    const blob = await Packer.toBlob(document);
    downloadBlob(blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", exportFileName(result.subject, "docx"));
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold sm:text-3xl">{t("gen.title")}</h1><p className="mt-1 text-muted-foreground">{t("gen.subtitle")}</p></div>
        {usage && <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm"><span className="font-medium">{usage.used}</span><span className="text-muted-foreground"> / {usage.quota} {t("pricing.emailsMonth")}</span></div>}
      </div>
      {quotaHit && <Card className="mb-6 border-warning/40 bg-warning/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{t("gen.quota.title")}</p><p className="text-sm text-muted-foreground">{t("gen.quota.desc")}</p></div><Link to="/pricing"><Button>{t("gen.quota.upgrade")}</Button></Link></CardContent></Card>}

      {showOnboarding && <Card className="mb-6 border-primary/25 bg-primary/5"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-display text-lg font-bold">Start with a real workflow</p><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose what you need to write and MailCraft will prepare the right structure, tone, and call to action.</p></div><Button variant="ghost" size="sm" onClick={dismissOnboarding}>Dismiss</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Button variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => applyTemplate("job-application")}><span><span className="block font-semibold">Apply for a job</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Application or recruiter reply</span></span></Button><Button variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => applyTemplate("freelance-proposal")}><span><span className="block font-semibold">Win freelance work</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Proposal or project response</span></span></Button><Button variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => applyTemplate("client-follow-up")}><span><span className="block font-semibold">Follow up with a client</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Keep the conversation moving</span></span></Button></div></CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="compose">{t("gen.mode.compose")}</TabsTrigger><TabsTrigger value="reply">{t("gen.mode.reply")}</TabsTrigger></TabsList></Tabs></CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("gen.workflow")} required><SelectBox value={workflow} onChange={(value) => applyWorkflow(value as CommunicationWorkflow)} options={workflows.map((item) => [item.id, t(item.labelKey)] as [string, string])} /></Field>
            <p className="-mt-2 text-xs text-muted-foreground">{t("gen.workflowHint")}</p>
            {mode === "reply" && <Field label={t("gen.field.incoming")}><Textarea rows={4} value={form.incomingEmail} placeholder={t("gen.field.incoming.ph")} onChange={(event) => set("incomingEmail", event.target.value)} /></Field>}
            {workflow === "custom" && <Field label={t("gen.customPurpose")} required><Textarea rows={2} value={form.purpose} placeholder={t("gen.customPurpose.ph")} onChange={(event) => set("purpose", event.target.value)} /></Field>}
            <div className="rounded-xl border border-border bg-muted/20 p-4"><p className="mb-1 font-semibold">{t("gen.clientFacts")}</p><p className="mb-3 text-xs text-muted-foreground">{t("gen.clientFactsHint")}</p><div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.clientName")} optional><Input value={clientContext.clientName} onChange={(event) => setClient("clientName", event.target.value)} placeholder="e.g. Ahmed" /></Field><Field label={t("gen.company")} optional><Input value={clientContext.company} onChange={(event) => setClient("company", event.target.value)} placeholder="e.g. Acme Studio" /></Field><Field label={t("gen.project")} optional><Input value={clientContext.project} onChange={(event) => setClient("project", event.target.value)} placeholder="e.g. Website redesign" /></Field><Field label={t("gen.service")} optional><Input value={clientContext.service} onChange={(event) => setClient("service", event.target.value)} placeholder="e.g. Brand identity" /></Field><Field label={t("gen.status")} optional><Input value={clientContext.projectStatus} onChange={(event) => setClient("projectStatus", event.target.value)} placeholder="e.g. Milestone approved" /></Field><Field label={t("gen.amount")} optional><Input value={clientContext.amount} onChange={(event) => setClient("amount", event.target.value)} placeholder="e.g. 5,000 EGP due" /></Field><Field label={t("gen.deadline")} optional><Input value={clientContext.deadline} onChange={(event) => setClient("deadline", event.target.value)} placeholder="e.g. 15 August" /></Field></div><div className="mt-4"><Field label={t("gen.otherFacts")} optional><Textarea rows={2} value={clientContext.importantFacts} onChange={(event) => setClient("importantFacts", event.target.value)} placeholder={t("gen.otherFacts.ph")} /></Field></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.tone")}><SelectBox value={form.tone} onChange={(value) => set("tone", value)} options={toneOptions(t)} /></Field><Field label={t("gen.field.length")}><SelectBox value={form.length} onChange={(value) => set("length", value)} options={[["short", t("gen.length.short")], ["medium", t("gen.length.medium")], ["long", t("gen.length.long")]]} /></Field></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.language")}><SelectBox value={language} onChange={(value) => setLanguage(value as "en" | "ar")} options={[["en", "English"], ["ar", "العربية"]]} /></Field><Field label={t("gen.nextAction")} optional><Input value={form.cta} placeholder={t("gen.nextAction.ph")} onChange={(event) => set("cta", event.target.value)} /></Field></div>
            <Button className="w-full gap-2 gradient-primary text-primary-foreground border-0" disabled={loading} onClick={() => void generate()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? t("gen.generating") : t("gen.generate")}</Button>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24 lg:self-start"><CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="text-lg">{t("gen.result.title")}</CardTitle>{result && <Button variant="outline" size="sm" className="gap-2" disabled={loading} onClick={() => void generate()}><RefreshCw className="h-3.5 w-3.5" />{t("gen.regenerate")}</Button>}</CardHeader><CardContent className="space-y-4">
          {!result ? <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 text-center text-muted-foreground"><Sparkles className="h-10 w-10 opacity-30" /><p>{t("gen.result.empty")}</p><p className="text-xs">Use Ctrl/Cmd + Enter to generate.</p></div> : <>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void copy(result.subject, "Subject copied.")}><Copy className="mr-1 h-3.5 w-3.5" />Subject</Button><Button variant="outline" size="sm" onClick={copyAll}><Copy className="mr-1 h-3.5 w-3.5" />Copy all</Button><Button variant="outline" size="sm" onClick={() => downloadBlob(`Subject: ${result.subject}\n\n${result.body}`, "text/plain", "mailcraft-email.txt")}><Download className="mr-1 h-3.5 w-3.5" />TXT</Button><Button variant="outline" size="sm" onClick={exportPdf}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button><Button variant="outline" size="sm" onClick={() => void exportDocx()}><FileText className="mr-1 h-3.5 w-3.5" />DOCX</Button></div>
            <div className="space-y-2"><Label className="flex items-center gap-1 text-xs uppercase text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" />Ranked subjects</Label>{result.subject_lines.map((subject, index) => <div key={`${subject}-${index}`} className={`flex items-center gap-2 rounded-lg border p-2 ${subject === result.subject ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}><button className="min-w-0 flex-1 text-left" onClick={() => setResult((current) => current ? { ...current, subject } : current)}><span className="mb-0.5 block text-xs font-medium text-muted-foreground">{subjectRankLabel(index, form.tone, selectedTemplate, form.purpose)}</span><span className="block truncate text-sm">{subject}</span></button><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Copy subject" onClick={() => void copy(subject, "Subject copied.")}><Copy className="h-3.5 w-3.5" /></Button></div>)}</div>
            <div><div className="mb-1 flex items-center justify-between"><Label className="text-xs uppercase text-muted-foreground">Email preview</Label><Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => void copy(result.body)}><Copy className="h-3 w-3" />{t("common.copy")}</Button></div><div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed shadow-sm">{result.body}</div></div>
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2"><Score label="Personalization" value={result.score.personalization} /><Score label="Clarity" value={result.score.clarity} /><Score label="Persuasion" value={result.score.persuasion} /><Score label="Overall quality" value={result.score.overall} /></div>
            {result.validation && <div className="rounded-lg border border-border bg-background p-3 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold">Fact validation</p><span className="text-xs uppercase text-muted-foreground">{result.validation.attempts} attempt{result.validation.attempts === 1 ? "" : "s"}</span></div><p className="mt-1 text-muted-foreground">{result.validation.status === "passed" ? "No unsupported claims were found before display." : "Unsupported claims were detected, so a conservative grounded draft was used."}</p>{result.validation.unsupported_claims_removed.length > 0 && <div className="mt-2 space-y-1 text-xs text-muted-foreground">{result.validation.unsupported_claims_removed.map((claim) => <p key={claim}>Removed: {claim}</p>)}</div>}</div>}
            {result.grounding && <div className={`rounded-lg border p-4 text-sm ${result.grounding.status === "grounded" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 font-semibold">{result.grounding.status === "grounded" ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}Grounded confidence</div><span className="font-display text-xl font-bold">{result.grounding.confidence}%</span></div><p className="mt-1 text-muted-foreground">{result.grounding.status === "grounded" ? "No unsupported claims detected in the draft." : "Review the highlighted claims before sending."}</p>{result.grounding.sources.length > 0 && <div className="mt-3"><p className="text-xs font-medium uppercase text-muted-foreground">Used information</p><div className="mt-1 flex flex-wrap gap-1.5">{result.grounding.sources.map((source) => <span key={source.label} className="rounded-md bg-background px-2 py-1 text-xs" title={source.detail}>✓ {source.label}</span>)}</div></div>}{result.grounding.potential_claims.length > 0 && <div className="mt-3 space-y-2"><p className="text-xs font-medium uppercase text-amber-700">Potentially invented</p>{result.grounding.potential_claims.map((claim) => <div key={`${claim.text}-${claim.reason}`} className="rounded-md bg-background/70 p-2"><p className="font-medium">“{claim.text}”</p><p className="mt-0.5 text-xs text-muted-foreground">{claim.reason}</p><p className="mt-1 text-xs text-amber-700">Recommendation: {claim.recommendation}</p></div>)}</div>}<p className="mt-3 text-xs text-muted-foreground">Ignored unless explicitly provided: {result.grounding.ignored_categories.join(", ")}.</p></div>}
            {result.quality && <div className="rounded-lg border border-border bg-background p-4 text-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Overall quality</p><p className="text-muted-foreground">A weighted score with explanations.</p></div><span className="font-display text-xl font-bold">{result.quality.overall}</span></div><div className="mt-4 space-y-3">{result.quality.dimensions.map((dimension) => <div key={dimension.key}><Score label={dimension.label} value={dimension.score} /><div className="mt-1 space-y-0.5 text-xs text-muted-foreground">{dimension.reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}{dimension.suggestion && <p className="text-amber-700">Suggestion: {dimension.suggestion}</p>}</div></div>)}</div></div>}
            {result.readability && <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-4 text-sm sm:grid-cols-4"><ReadingStat label="Words" value={result.readability.word_count.toString()} /><ReadingStat label="Reading time" value={`${result.readability.reading_time_seconds} sec`} /><ReadingStat label="Reading level" value={result.readability.reading_level} /><ReadingStat label="Paragraphs" value={result.readability.paragraphs.toString()} /></div>}
            {result.analytics && <div className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"><Score label="Readability" value={result.analytics.readability ?? 0} /><Score label="CTA strength" value={result.analytics.cta_strength ?? 0} /><Score label="Spam safety" value={100 - (result.analytics.spam_risk ?? 0)} /><Score label="Response likelihood" value={result.analytics.response_likelihood ?? 0} /></div>}
            {result.strategy && <div className="rounded-lg border border-border bg-background p-4 text-sm"><div className="mb-2 flex items-center gap-2 font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" />AI strategy</div>{result.strategy.summary && <p className="text-muted-foreground">{result.strategy.summary}</p>}<div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2"><StrategyItem label="Tone" value={result.strategy.tone} /><StrategyItem label="Goal" value={result.strategy.goal} /><StrategyItem label="Audience" value={result.strategy.audience} /><StrategyItem label="Primary CTA" value={result.strategy.primary_cta} /><StrategyItem label="Writing style" value={result.strategy.writing_style} /><StrategyItem label="Facts used" value={result.strategy.facts_used?.toString()} /><StrategyItem label="Reading time" value={result.strategy.estimated_reading_time_seconds ? `${result.strategy.estimated_reading_time_seconds} sec` : undefined} /></div>{result.strategy.why_it_should_work?.length ? <ul className="mt-3 space-y-1 text-muted-foreground">{result.strategy.why_it_should_work.map((item) => <li key={item}>• {item}</li>)}</ul> : null}</div>}
            {result.revision?.changes.length ? <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm"><p className="font-semibold">Changes from previous version</p><div className="mt-2 space-y-1 text-muted-foreground">{result.revision.changes.map((change) => <p key={change}>✓ {change}</p>)}</div></div> : null}
            <div className="flex flex-wrap gap-2">{(["shorter", "longer", "formal", "casual", "friendlier", "warmer", "confident", "simpler_english", "more_natural", "follow_up", "direct", "polite", "executive", "ceo", "persuasive", "concise", "recruiter", "ats_friendly", "sales", "sales_pitch", "investor", "customer_support", "networking", "british", "american"] as Refinement[]).map((refinement) => <Button key={refinement} variant={activeRefinement === refinement ? "default" : "secondary"} size="sm" disabled={loading} aria-pressed={activeRefinement === refinement} onClick={() => void generate(refinement)}><Wand2 className="mr-1 h-3 w-3" />{rewriteLabel(refinement)}</Button>)}</div>
          </>}</CardContent></Card>
      </div>
    </AppLayout>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value || 0)));
  return <div><div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><span>{normalized}</span></div><Progress value={normalized} className="h-2" /></div>;
}

function StrategyItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>;
}

function ReadingStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-0.5 font-semibold">{value}</p></div>;
}

function subjectRankLabel(index: number, tone: string, template: string, purpose: string) {
  const context = `${template} ${purpose} ${tone}`.toLowerCase();
  if (index === 0) {
    if (context.includes("ats") || context.includes("job") || context.includes("application") || context.includes("recruiter")) return "1. Best for ATS";
    if (context.includes("sales") || context.includes("outreach")) return "1. Best for replies";
    if (context.includes("support")) return "1. Best for clarity";
    return "1. Best overall";
  }
  if (index === 1) {
    if (tone === "investor") return "2. Investor-ready";
    if (tone === "recruiter") return "2. Recruiter-friendly";
    return "2. Most professional";
  }
  if (index === 2) return "3. Shortest";
  return `${index + 1}. Alternative`;
}

function rewriteLabel(refinement: Refinement) {
  const labels: Record<Refinement, string> = {
    shorter: "Shorter", longer: "Longer", formal: "Formal", casual: "Casual", executive: "Executive", persuasive: "Persuasive", concise: "Concise", recruiter: "Recruiter", investor: "Investor", sales: "Sales", british: "British", american: "American",
    friendlier: "Friendlier", warmer: "Warmer", confident: "More confident", simpler_english: "Simpler English", more_natural: "More natural", follow_up: "Follow-up", direct: "More direct", polite: "More polite", ats_friendly: "ATS friendly", ceo: "CEO style", sales_pitch: "Sales pitch", customer_support: "Customer support", networking: "Networking",
  };
  return labels[refinement];
}

function emailParagraph(line: string) {
  if (!line.trim()) return new Paragraph({ text: "", spacing: { after: 120 } });
  const parts = line.split(/(https?:\/\/\S+)/g).filter(Boolean);
  return new Paragraph({
    children: parts.map((part) => /^https?:\/\//.test(part)
      ? new ExternalHyperlink({ link: part, children: [new TextRun({ text: part, color: "2563EB", underline: {} })] })
      : new TextRun({ text: part })),
    spacing: { after: 120 },
  });
}

function cleanPdfText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .trimEnd();
}

function wrapPdfText(pdf: jsPDF, value: string, maxWidth: number) {
  const text = cleanPdfText(value);
  if (!text.trim()) return [" "];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (pdf.getTextWidth(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (pdf.getTextWidth(word) <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (pdf.getTextWidth(next) <= maxWidth) chunk = next;
      else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines;
}

function exportFileName(subject: string, extension: "pdf" | "docx") {
  const safeSubject = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "email";
  return `mailcraft-${safeSubject}.${extension}`;
}

function Field({ label, children, required, optional }: { label: string; children: ReactNode; required?: boolean; optional?: boolean }) {
  const { t } = useLanguage();
  return <div className="space-y-1.5"><Label className="text-sm">{label}{required && <span className="text-destructive"> *</span>}{optional && <span className="ms-1 text-xs text-muted-foreground">({t("common.optional")})</span>}</Label>{children}</div>;
}

function SelectBox({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([value, label]) => <SelectItem key={value || "placeholder"} value={value} disabled={!value}>{label}</SelectItem>)}</SelectContent></Select>;
}

function toneOptions(t: (key: string) => string): [string, string][] {
  return [["formal", t("gen.tone.formal")], ["friendly", t("gen.tone.friendly")], ["firm", t("gen.tone.firm")], ["persuasive", "Persuasive"], ["apologetic", t("gen.tone.apologetic")], ["enthusiastic", t("gen.tone.enthusiastic")], ["casual", "Casual"], ["executive", "Executive"], ["concise", "Concise"], ["recruiter", "Recruiter"], ["investor", "Investor"], ["sales", "Sales"]];
}
