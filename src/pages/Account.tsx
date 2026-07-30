import { type ReactNode, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Building2, Globe2, LogOut, Save } from "lucide-react";

type ProfileForm = {
  fullName: string;
  jobTitle: string;
  company: string;
  companyWebsite: string;
  industry: string;
  country: string;
  preferredSignature: string;
  defaultTone: string;
  defaultLanguage: "en" | "ar";
  linkedInUrl: string;
  phoneNumber: string;
  preferredPronouns: string;
  timeZone: string;
  preferredGreeting: string;
  defaultCta: string;
  defaultSignOff: string;
};

const accountDraftPrefix = "mailcraft:account-profile-draft:";

const emptyProfile: ProfileForm = {
  fullName: "",
  jobTitle: "",
  company: "",
  companyWebsite: "",
  industry: "",
  country: "",
  preferredSignature: "",
  defaultTone: "formal",
  defaultLanguage: "en",
  linkedInUrl: "",
  phoneNumber: "",
  preferredPronouns: "",
  timeZone: "",
  preferredGreeting: "",
  defaultCta: "",
  defaultSignOff: "",
};

function draftKey(userId: string) {
  return `${accountDraftPrefix}${userId}`;
}

function normalizeProfileDraft(value: Partial<ProfileForm>, locale: "en" | "ar"): ProfileForm {
  return {
    ...emptyProfile,
    ...value,
    defaultLanguage: value.defaultLanguage === "ar" || value.defaultLanguage === "en" ? value.defaultLanguage : locale,
  };
}

function readProfileDraft(userId: string, locale: "en" | "ar") {
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileForm>;
    return normalizeProfileDraft(parsed, locale);
  } catch {
    return null;
  }
}

function writeProfileDraft(userId: string, profile: ProfileForm) {
  window.localStorage.setItem(draftKey(userId), JSON.stringify(profile));
}

function clearProfileDraft(userId: string) {
  window.localStorage.removeItem(draftKey(userId));
}

export default function Account() {
  const { t, locale, setLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileForm>({ ...emptyProfile, defaultLanguage: locale });
  const [planName, setPlanName] = useState<string>(t("pricing.free"));
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const profileDirtyRef = useRef(false);

  const setField = (key: keyof ProfileForm, value: string) => {
    profileDirtyRef.current = true;
    setProfile((current) => {
      const next = { ...current, [key]: value };
      if (user) writeProfileDraft(user.id, next);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    setProfileLoaded(false);
    profileDirtyRef.current = false;

    supabase
      .from("profiles")
      .select("full_name, default_role, default_signature, locale, job_title, company, company_website, industry, country, preferred_signature, default_tone, default_language, linkedin_url, phone_number, preferred_pronouns, timezone, preferred_greeting, default_cta, default_sign_off")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const defaultLanguage = (data?.default_language || data?.locale || locale) as "en" | "ar";
        const savedProfile = normalizeProfileDraft({
          fullName: data?.full_name ?? "",
          jobTitle: data?.job_title ?? data?.default_role ?? "",
          company: data?.company ?? "",
          companyWebsite: data?.company_website ?? "",
          industry: data?.industry ?? "",
          country: data?.country ?? "",
          preferredSignature: data?.preferred_signature ?? data?.default_signature ?? "",
          defaultTone: data?.default_tone ?? "formal",
          defaultLanguage,
          linkedInUrl: data?.linkedin_url ?? "",
          phoneNumber: data?.phone_number ?? "",
          preferredPronouns: data?.preferred_pronouns ?? "",
          timeZone: data?.timezone ?? "",
          preferredGreeting: data?.preferred_greeting ?? "",
          defaultCta: data?.default_cta ?? "",
          defaultSignOff: data?.default_sign_off ?? "",
        }, defaultLanguage);
        const draftProfile = readProfileDraft(user.id, defaultLanguage);
        const nextProfile = draftProfile ?? savedProfile;
        if (profileDirtyRef.current) {
          setProfileLoaded(true);
          return;
        }
        setProfile(nextProfile);
        setLocale(nextProfile.defaultLanguage);
        setProfileLoaded(true);
      });

    supabase
      .from("subscriptions")
      .select("status, plans(name_en, name_ar)")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === "active" && data?.plans) {
          setPlanName(locale === "ar" ? data.plans.name_ar : data.plans.name_en);
        }
      });
  }, [user, locale, setLocale]);

  useEffect(() => {
    if (!user || !profileLoaded) return;
    writeProfileDraft(user.id, profile);
  }, [profile, profileLoaded, user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.fullName || null,
        default_role: profile.jobTitle || null,
        job_title: profile.jobTitle || null,
        company: profile.company || null,
        company_website: profile.companyWebsite || null,
        industry: profile.industry || null,
        country: profile.country || null,
        default_signature: profile.preferredSignature || null,
        preferred_signature: profile.preferredSignature || null,
        default_tone: profile.defaultTone,
        default_language: profile.defaultLanguage,
        locale: profile.defaultLanguage,
        linkedin_url: profile.linkedInUrl || null,
        phone_number: profile.phoneNumber || null,
        preferred_pronouns: profile.preferredPronouns || null,
        timezone: profile.timeZone || null,
        preferred_greeting: profile.preferredGreeting || null,
        default_cta: profile.defaultCta || null,
        default_sign_off: profile.defaultSignOff || null,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) toast.error(error.message);
    else {
      clearProfileDraft(user.id);
      profileDirtyRef.current = false;
      setLocale(profile.defaultLanguage);
      toast.success(t("account.saved"));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AppLayout>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("account.title")}</h1>
      <p className="mt-1 text-muted-foreground">
        Build a reusable profile so MailCraft can personalize every draft without asking the same questions again.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Writing profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={profile.fullName} onChange={(e) => setField("fullName", e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Job title">
              <Input value={profile.jobTitle} onChange={(e) => setField("jobTitle", e.target.value)} placeholder="Founder, Sales Lead, Product Manager" />
            </Field>
            <Field label="Company">
              <Input value={profile.company} onChange={(e) => setField("company", e.target.value)} autoComplete="organization" />
            </Field>
            <Field label="Company website">
              <Input value={profile.companyWebsite} onChange={(e) => setField("companyWebsite", e.target.value)} placeholder="https://example.com" inputMode="url" />
            </Field>
            <Field label="Industry">
              <Input value={profile.industry} onChange={(e) => setField("industry", e.target.value)} placeholder="SaaS, Real Estate, Recruiting" />
            </Field>
            <Field label="Country">
              <Input value={profile.country} onChange={(e) => setField("country", e.target.value)} autoComplete="country-name" />
            </Field>
            <Field label="LinkedIn URL" optional>
              <Input type="url" value={profile.linkedInUrl} onChange={(e) => setField("linkedInUrl", e.target.value)} placeholder="https://linkedin.com/in/your-name" inputMode="url" autoComplete="url" />
            </Field>
            <Field label="Phone number" optional>
              <Input type="tel" value={profile.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} autoComplete="tel" />
            </Field>
            <Field label="Preferred pronouns" optional>
              <Input value={profile.preferredPronouns} onChange={(e) => setField("preferredPronouns", e.target.value)} placeholder="she/her, he/him, they/them" />
            </Field>
            <Field label="Time zone" optional>
              <Input value={profile.timeZone} onChange={(e) => setField("timeZone", e.target.value)} placeholder="Africa/Cairo" autoComplete="off" />
            </Field>
            <Field label="Default tone">
              <Select value={profile.defaultTone} onValueChange={(value) => setField("defaultTone", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["formal", "friendly", "executive", "persuasive", "concise", "recruiter", "investor", "sales"].map((tone) => (
                    <SelectItem key={tone} value={tone}>{tone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default language">
              <Select value={profile.defaultLanguage} onValueChange={(value) => setField("defaultLanguage", value as "en" | "ar")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred greeting" optional>
              <Input value={profile.preferredGreeting} onChange={(e) => setField("preferredGreeting", e.target.value)} placeholder="Hi, Hello, Dear" />
            </Field>
            <Field label="Default sign-off" optional>
              <Input value={profile.defaultSignOff} onChange={(e) => setField("defaultSignOff", e.target.value)} placeholder="Best regards," />
            </Field>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Default CTA <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={profile.defaultCta} onChange={(e) => setField("defaultCta", e.target.value)} placeholder="Would you be open to a short call next week?" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Preferred signature</Label>
              <Textarea
                rows={4}
                value={profile.preferredSignature}
                placeholder={"Best regards,\nYour Name\nTitle, Company"}
                onChange={(e) => setField("preferredSignature", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between py-4">
              <span className="font-medium">{planName}</span>
              <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>{t("nav.pricing")}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 className="h-4 w-4" /> Personalization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Profile data is used only to ground drafts in facts you provide.</p>
              <p>MailCraft will not invent clients, metrics, experience, or company claims.</p>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full gap-2 text-destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> {t("account.dangerSignout")}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{optional && <span className="text-muted-foreground"> (optional)</span>}</Label>
      {children}
    </div>
  );
}
