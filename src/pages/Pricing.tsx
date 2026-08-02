import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/supabase/client";
import { toast } from "sonner";
import { Mail, Check } from "lucide-react";

type Plan = {
  id: string; slug: string; name_en: string; name_ar: string;
  price_egp: number; monthly_quota: number; features_en: string[]; features_ar: string[]; sort_order: number;
};

export default function Pricing() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setPlans((data as Plan[]) ?? []));
    if (user) {
      supabase.from("subscriptions").select("status, plans(slug)").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.status === "active" && data?.plans?.slug) setCurrentSlug(data.plans.slug); });
    } else {
      setCurrentSlug("free");
    }
  }, [user]);

  const startCheckout = async (planSlug: string) => {
    if (!user) {
      window.location.assign("/login?redirect=/pricing");
      return;
    }
    setCheckoutSlug(planSlug);
    const { data, error } = await supabase.functions.invoke("create-payment", { body: { planSlug } });
    setCheckoutSlug(null);
    if (error || !data?.checkoutUrl) {
      toast.error(t("pricing.paymentError"));
      return;
    }
    window.location.assign(data.checkoutUrl);
  };

  const Body = (
    <>
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("pricing.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const popular = p.slug === "pro";
          const isCurrent = currentSlug === p.slug || (!currentSlug && p.slug === "free");
          const name = locale === "ar" ? p.name_ar : p.name_en;
          const features = locale === "ar" ? p.features_ar : p.features_en;
          return (
            <Card key={p.id} className={popular ? "relative border-primary shadow-lg" : "relative"}>
              {popular && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground rtl:translate-x-1/2">
                  {t("pricing.popular")}
                </span>
              )}
              <CardContent className="p-6">
                <h3 className="font-display text-xl font-bold">{name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price_egp === 0 ? t("pricing.free") : `${p.price_egp} EGP`}</span>
                  {p.price_egp > 0 && <span className="text-sm text-muted-foreground">{t("pricing.month")}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.monthly_quota} {t("pricing.emailsMonth")}</p>
                <ul className="mt-5 space-y-2">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full" disabled>{t("pricing.current")}</Button>
                  ) : p.slug === "free" ? (
                    <Link to={user ? "/app" : "/signup"}><Button variant="outline" className="w-full">{t("pricing.getStarted")}</Button></Link>
                  ) : (
                    <Button className="w-full" disabled={checkoutSlug === p.slug} onClick={() => void startCheckout(p.slug)}>
                      {checkoutSlug === p.slug ? t("pricing.processing") : t("pricing.choose")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );

  if (user) return <AppLayout>{Body}</AppLayout>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary"><Mail className="h-5 w-5 text-primary-foreground" /></div>
            <span className="text-lg font-bold font-display">{t("brand.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link to="/login"><Button variant="ghost" size="sm">{t("nav.signin")}</Button></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-16 lg:px-8">{Body}</main>
    </div>
  );
}
