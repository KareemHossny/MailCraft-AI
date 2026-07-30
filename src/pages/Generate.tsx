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

type Mode = "compose" | "reply";
type Refinement = "shorter" | "longer" | "formal" | "casual" | "executive" | "persuasive" | "concise" | "recruiter" | "investor" | "sales" | "british" | "american" | "friendlier" | "warmer" | "confident" | "simpler_english" | "more_natural" | "follow_up" | "direct" | "polite" | "ats_friendly" | "ceo" | "sales_pitch" | "customer_support" | "networking";
type Snippet = { id: string; title: string; body: string };
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
  { id: "support-response", category: "Support", title: "Support response", purpose: "Resolve a customer issue clearly and respectfully.", tone: "friendly", cta: "Please reply if there is anything else we can help with." },
  { id: "executive-update", category: "Executive", title: "Executive update", purpose: "Share a concise decision-ready business update.", tone: "executive", cta: "Please confirm the preferred next step." },
  { id: "investor-intro", category: "Executive", title: "Investor introduction", purpose: "Make a focused introduction to a potential investor.", tone: "investor", cta: "Would you be open to a short introductory conversation?" },
];

export default function Generate() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("compose");
  const [form, setForm] = useState({
    senderRole: "", recipientRole: "", purpose: "", keyPoints: "", incomingEmail: "",
    tone: "formal", length: "medium", urgency: "normal", cta: "", context: "", avoid: "",
  });
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
  const generatingRef = useRef(false);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const loadUsage = useCallback(async () => {
    if (!user) return;
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01`;
    const [{ data: counter }, { data: subscription }] = await Promise.all([
      supabase.from("usage_counters").select("emails_used").eq("user_id", user.id).eq("period_start", period).maybeSingle(),
      supabase.from("subscriptions").select("status, plans(monthly_quota)").eq("user_id", user.id).maybeSingle(),
    ]);
    let quota = 15;
    if (subscription?.status === "active" && subscription.plans?.monthly_quota) quota = subscription.plans.monthly_quota;
    else {
      const { data: freePlan } = await supabase.from("plans").select("monthly_quota").eq("slug", "free").maybeSingle();
      if (freePlan?.monthly_quota != null) quota = freePlan.monthly_quota;
    }
    setUsage({ used: counter?.emails_used ?? 0, quota });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadWorkspace = async () => {
      const [{ data: profile }, { data: savedSnippets }] = await Promise.all([
        supabase.from("profiles").select("full_name, default_role, default_signature, locale, job_title, preferred_signature, default_tone, default_language, default_cta, default_sign_off").eq("user_id", user.id).maybeSingle(),
        supabase.from("snippets").select("id, title, body").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (profile) {
        if (profile.job_title || profile.default_role) setForm((current) => ({ ...current, senderRole: profile.job_title || profile.default_role || "" }));
        if (profile.preferred_signature || profile.default_signature || profile.default_sign_off) setSignature(profile.preferred_signature || profile.default_signature || profile.default_sign_off || "");
        if (profile.default_tone) setForm((current) => ({ ...current, tone: profile.default_tone }));
        if (profile.default_cta) setForm((current) => ({ ...current, cta: current.cta || profile.default_cta }));
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
          ...form, ...(refine ? { refine, previousSubject: result?.subject, previousBody: result?.body, previousHistoryId: result?.historyId } : {}),
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
    pdf.text(pdf.splitTextToSize(result.subject, contentWidth), margin, margin + 38);
    let y = margin + 66;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const writeLine = (line: string) => {
      const urlOnly = line.trim().match(/^https?:\/\/\S+$/)?.[0];
      const lines = pdf.splitTextToSize(line || " ", contentWidth) as string[];
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="compose">{t("gen.mode.compose")}</TabsTrigger><TabsTrigger value="reply">{t("gen.mode.reply")}</TabsTrigger></TabsList></Tabs></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Template"><SelectBox value={selectedTemplate} onChange={applyTemplate} options={[["custom", "Custom email"], ...templates.map((item) => [item.id, `${item.category}: ${item.title}`] as [string, string])]} /></Field>
            {mode === "reply" && <Field label={t("gen.field.incoming")}><Textarea rows={4} value={form.incomingEmail} placeholder={t("gen.field.incoming.ph")} onChange={(event) => set("incomingEmail", event.target.value)} /></Field>}
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.senderRole")}><Input value={form.senderRole} placeholder={t("gen.field.senderRole.ph")} onChange={(event) => set("senderRole", event.target.value)} /></Field><Field label={t("gen.field.recipientRole")}><Input value={form.recipientRole} placeholder={t("gen.field.recipientRole.ph")} onChange={(event) => set("recipientRole", event.target.value)} /></Field></div>
            <Field label={t("gen.field.purpose")} required={mode === "compose"}><Textarea rows={2} value={form.purpose} placeholder={t("gen.field.purpose.ph")} onChange={(event) => set("purpose", event.target.value)} /></Field>
            <Field label={t("gen.field.keyPoints")} optional><Textarea rows={4} value={form.keyPoints} placeholder={t("gen.field.keyPoints.ph")} onChange={(event) => set("keyPoints", event.target.value)} /></Field>
            {snippets.length > 0 && <Field label="Add snippet" optional><SelectBox value="" onChange={insertSnippet} options={[["", "Select a saved snippet"], ...snippets.map((snippet) => [snippet.id, snippet.title] as [string, string])]} /></Field>}
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.tone")}><SelectBox value={form.tone} onChange={(value) => set("tone", value)} options={toneOptions(t)} /></Field><Field label={t("gen.field.length")}><SelectBox value={form.length} onChange={(value) => set("length", value)} options={[["short", t("gen.length.short")], ["medium", t("gen.length.medium")], ["long", t("gen.length.long")]]} /></Field></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.language")}><SelectBox value={language} onChange={(value) => setLanguage(value as "en" | "ar")} options={[["en", "English"], ["ar", "العربية"]]} /></Field>{language === "en" && <Field label="English variant"><SelectBox value={englishVariant} onChange={(value) => setEnglishVariant(value as "american" | "british")} options={[["american", "American English"], ["british", "British English"]]} /></Field>}</div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={t("gen.field.urgency")}><SelectBox value={form.urgency} onChange={(value) => set("urgency", value)} options={[["low", t("gen.urgency.low")], ["normal", t("gen.urgency.normal")], ["high", t("gen.urgency.high")]]} /></Field><Field label={t("gen.field.cta")} optional><Input value={form.cta} placeholder={t("gen.field.cta.ph")} onChange={(event) => set("cta", event.target.value)} /></Field></div>
            <Field label={t("gen.field.context")} optional><Textarea rows={2} value={form.context} placeholder={t("gen.field.context.ph")} onChange={(event) => set("context", event.target.value)} /></Field>
            <Field label={t("gen.field.avoid")} optional><Input value={form.avoid} placeholder={t("gen.field.avoid.ph")} onChange={(event) => set("avoid", event.target.value)} /></Field>
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
