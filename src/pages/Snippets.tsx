import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Copy } from "lucide-react";

type Snippet = { id: string; title: string; body: string };

export default function Snippets() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<Snippet[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("snippets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data as Snippet[]) ?? []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    await supabase.from("snippets").insert({ user_id: user.id, title: title.trim(), body: body.trim() });
    toast.success(t("snippets.saved"));
    setTitle(""); setBody(""); setAdding(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("snippets").delete().eq("id", id);
    toast.success(t("snippets.deleted")); load();
  };
  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success(t("common.copied")); };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("snippets.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("snippets.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setAdding((a) => !a)}><Plus className="h-4 w-4" /> {t("snippets.new")}</Button>
      </div>

      {adding && (
        <Card className="my-6">
          <CardContent className="space-y-4 py-5">
            <div className="space-y-1.5">
              <Label>{t("snippets.titleField")}</Label>
              <Input value={title} placeholder={t("snippets.titleField.ph")} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("snippets.bodyField")}</Label>
              <Textarea rows={3} value={body} placeholder={t("snippets.bodyField.ph")} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>{t("common.save")}</Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !adding ? (
        <p className="py-16 text-center text-muted-foreground">{t("snippets.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((s) => (
            <Card key={s.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{s.title}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(s.body)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
