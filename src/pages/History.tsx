import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, CopyPlus, Pencil, Search, Star, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/services/supabase/client";
import { toast } from "sonner";

type Item = {
  id: string;
  title: string | null;
  subject: string | null;
  body: string;
  language: string;
  tone: string | null;
  is_favorite: boolean;
  created_at: string;
  mode: string;
  purpose: string | null;
  requested_length: string | null;
  generation_version: number;
  revision_action: string | null;
  template: string | null;
};

export default function History() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const [language, setLanguage] = useState("all");
  const [tone, setTone] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("email_history")
      .select("id, title, subject, body, language, tone, mode, purpose, requested_length, generation_version, revision_action, template, is_favorite, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Could not load your email history.");
      return;
    }
    setItems((data as Item[]) ?? []);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const toggleFavorite = async (item: Item) => {
    const { error } = await supabase.from("email_history").update({ is_favorite: !item.is_favorite }).eq("id", item.id);
    if (error) toast.error("Could not update favorite.");
    else void load();
  };

  const rename = async (item: Item) => {
    const title = window.prompt("Name this email", item.title || item.subject || "Untitled email");
    if (title === null || !title.trim()) return;
    const { error } = await supabase.from("email_history").update({ title: title.trim() }).eq("id", item.id);
    if (error) toast.error("Could not rename the email.");
    else {
      toast.success("Email renamed.");
      void load();
    }
  };

  const duplicate = async (item: Item) => {
    if (!user) return;
    const { error } = await supabase.from("email_history").insert({
      user_id: user.id,
      title: `${item.title || item.subject || "Untitled email"} copy`,
      subject: item.subject,
      body: item.body,
      language: item.language,
      tone: item.tone,
      mode: item.mode,
      is_favorite: false,
      purpose: item.purpose,
      requested_length: item.requested_length,
      template: item.template,
      generation_version: 1,
      revision_action: null,
      parent_history_id: null,
      inputs: { duplicated_from: item.id },
    });
    if (error) toast.error("Could not duplicate the email.");
    else {
      toast.success("Email duplicated.");
      void load();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this email from history?")) return;
    const { error } = await supabase.from("email_history").delete().eq("id", id);
    if (error) toast.error("Could not delete the email.");
    else {
      toast.success(t("history.deleted"));
      void load();
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error("Copy failed. Please select the text manually.");
    }
  };

  const tones = useMemo(() => [...new Set(items.map((item) => item.tone).filter(Boolean))] as string[], [items]);
  const filtered = items.filter((item) => {
    const haystack = `${item.title || ""} ${item.subject || ""} ${item.purpose || ""} ${item.body}`.toLowerCase();
    return (filter !== "fav" || item.is_favorite)
      && (language === "all" || item.language === language)
      && (tone === "all" || item.tone === tone)
      && (!query || haystack.includes(query.toLowerCase()));
  });

  return <AppLayout>
    <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("history.title")}</h1>
    <p className="mt-1 text-muted-foreground">{t("history.subtitle")}</p>
    <div className="my-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9" placeholder={t("history.search")} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "fav")}>
        <TabsList><TabsTrigger value="all">{t("history.all")}</TabsTrigger><TabsTrigger value="fav">{t("history.favorites")}</TabsTrigger></TabsList>
      </Tabs>
      <HistorySelect value={language} onChange={setLanguage} label="Language" options={[["all", "All languages"], ["en", "English"], ["ar", "Arabic"]]} />
      <HistorySelect value={tone} onChange={setTone} label="Tone" options={[["all", "All tones"], ...tones.map((value) => [value, value] as [string, string])]} />
    </div>

    {filtered.length === 0 ? <div className="py-16 text-center text-muted-foreground"><p>{t("history.empty")}</p><p className="mt-1 text-sm">Generated emails will appear here and remain ready to reuse.</p></div> : <div className="space-y-4">
      {filtered.map((item) => <Card key={item.id}>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.title || item.subject || "Untitled email"}</p>
              {item.title && item.subject && <p className="mt-1 truncate text-sm text-muted-foreground">{item.subject}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                <HistoryTag label={`Version ${item.generation_version || 1}`} />
                {item.purpose && <HistoryTag label={item.purpose} />}
                {item.tone && <HistoryTag label={item.tone} />}
                {item.requested_length && <HistoryTag label={item.requested_length} />}
                {item.revision_action && <HistoryTag label={`${rewriteLabel(item.revision_action)} rewrite`} />}
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()} | {item.language.toUpperCase()}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <IconButton label="Favorite" onClick={() => void toggleFavorite(item)}><Star className={`h-4 w-4 ${item.is_favorite ? "fill-accent text-accent" : ""}`} /></IconButton>
              <IconButton label="Rename" onClick={() => void rename(item)}><Pencil className="h-4 w-4" /></IconButton>
              <IconButton label="Duplicate" onClick={() => void duplicate(item)}><CopyPlus className="h-4 w-4" /></IconButton>
              <IconButton label="Copy" onClick={() => void copy(`${item.subject ? `Subject: ${item.subject}\n\n` : ""}${item.body}`)}><Copy className="h-4 w-4" /></IconButton>
              <IconButton label="Delete" destructive onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></IconButton>
            </div>
          </div>
        </CardContent>
      </Card>)}
    </div>}
  </AppLayout>;
}

function HistorySelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: [string, string][] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="w-[150px]" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent></Select>;
}

function IconButton({ label, destructive, children, onClick }: { label: string; destructive?: boolean; children: ReactNode; onClick: () => void }) {
  return <Button variant="ghost" size="icon" className={`h-8 w-8 ${destructive ? "text-destructive" : ""}`} title={label} aria-label={label} onClick={onClick}>{children}</Button>;
}

function HistoryTag({ label }: { label: string }) {
  return <span className="max-w-full truncate rounded-md border border-border bg-muted/40 px-2 py-0.5">{label}</span>;
}

function rewriteLabel(action: string) {
  return action.replace(/_/g, " ");
}
