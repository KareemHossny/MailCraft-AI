import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail, Sparkles, Languages, SlidersHorizontal, Reply, Bookmark, History, Zap, ArrowRight, Check,
} from "lucide-react";
import heroImage from "@/assets/hero-email.jpg";

export default function Landing() {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const appHref = user ? "/app" : "/signup";
  const Arrow = dir === "rtl" ? ArrowRight : ArrowRight;

  const steps = [
    { icon: Sparkles, title: "landing.how.step1.title", desc: "landing.how.step1.desc" },
    { icon: Mail, title: "landing.how.step2.title", desc: "landing.how.step2.desc" },
    { icon: Zap, title: "landing.how.step3.title", desc: "landing.how.step3.desc" },
  ] as const;

  const features = [
    { icon: Languages, title: "landing.feature.bilingual.title", desc: "landing.feature.bilingual.desc" },
    { icon: SlidersHorizontal, title: "landing.feature.tones.title", desc: "landing.feature.tones.desc" },
    { icon: Reply, title: "landing.feature.reply.title", desc: "landing.feature.reply.desc" },
    { icon: Bookmark, title: "landing.feature.snippets.title", desc: "landing.feature.snippets.desc" },
    { icon: History, title: "landing.feature.history.title", desc: "landing.feature.history.desc" },
    { icon: Zap, title: "landing.feature.fast.title", desc: "landing.feature.fast.desc" },
  ] as const;

  const plans = [
    {
      name: t("pricing.free"),
      price: t("pricing.free"),
      quota: `10 ${t("pricing.emailsMonth")}`,
      features: ["landing.pricing.free.feature1", "landing.pricing.free.feature2", "landing.pricing.free.feature3"],
      cta: t("pricing.getStarted"),
      href: appHref,
      featured: false,
    },
    {
      name: "Pro",
      price: "199 EGP",
      quota: "Saved client context + higher usage",
      features: ["landing.pricing.pro.feature1", "landing.pricing.pro.feature2", "landing.pricing.pro.feature3"],
      cta: t("pricing.choose"),
      href: "/pricing",
      featured: true,
    },
    {
      name: "Business",
      price: "499 EGP",
      quota: "Agency workflows + team features",
      features: ["landing.pricing.business.feature1", "landing.pricing.business.feature2", "landing.pricing.business.feature3"],
      cta: t("pricing.choose"),
      href: "/pricing",
      featured: false,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-md">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display">{t("brand.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href="#features" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
              {t("nav.features")}
            </a>
            <a href="#pricing" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
              {t("nav.pricing")}
            </a>
            <LanguageToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">{t("nav.signin")}</Button>
            </Link>
            <Link to={appHref}>
              <Button size="sm" className="gradient-primary text-primary-foreground border-0">
                {t("nav.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.hero.badge")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={appHref}>
                <Button size="lg" className="gap-2 gradient-primary text-primary-foreground border-0 shadow-glow">
                  {t("landing.hero.cta")}
                  <Arrow className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline">{t("landing.hero.secondary")}</Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{t("landing.hero.note")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2rem] gradient-primary opacity-20 blur-3xl" />
            <img
              src={heroImage}
              alt={t("brand.tagline")}
              width={1024}
              height={768}
              className="relative w-full rounded-3xl border border-border/60 shadow-lg"
            />
          </motion.div>
        </div>
      </section>

      {/* Public conversion demo */}
      <section className="border-t border-border/60 bg-secondary/20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t("landing.demo.badge")}</span>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t("landing.demo.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("landing.demo.subtitle")}</p>
            <Link to={appHref} className="mt-6 inline-block"><Button className="gradient-primary text-primary-foreground">{t("landing.demo.button")}</Button></Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{t("landing.demo.workflow")}</span><span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">{t("landing.demo.language")}</span><span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">{t("landing.demo.grounded")}</span></div>
            <p className="text-sm font-semibold">{t("landing.demo.subject")}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{t("landing.demo.body")}</p>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"><Button variant="outline" size="sm" onClick={() => window.location.assign(appHref)}>{t("landing.demo.copy")}</Button><span className="self-center text-xs text-muted-foreground">{t("landing.demo.note")}</span></div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-gradient-to-b from-transparent to-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.how.title")}
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-md">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="absolute end-6 top-6 font-display text-4xl font-bold text-muted/40">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(s.title)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(s.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.features.title")}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{t(f.title)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(f.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-secondary/20">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t("pricing.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-card p-6 shadow-sm ${plan.featured ? "border-primary shadow-lg" : "border-border"}`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 start-6 rounded-full gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    {t("pricing.popular")}
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.price !== t("pricing.free") && <span className="text-sm text-muted-foreground">{t("pricing.month")}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.quota}</p>
                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{t(feature)}</span>
                    </li>
                  ))}
                </ul>
                <Link to={plan.href} className="mt-6 block">
                  <Button className="w-full" variant={plan.featured ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 lg:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl gradient-hero p-10 text-center sm:p-16">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {t("landing.cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t("landing.cta.subtitle")}</p>
          <Link to={appHref} className="mt-8 inline-block">
            <Button size="lg" className="gap-2 bg-white text-foreground hover:bg-white/90">
              {t("landing.cta.button")}
              <Arrow className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{t("brand.name")}</span>
          </div>
          <span>© {new Date().getFullYear()} {t("brand.name")}. {t("landing.footer.rights")}</span>
        </div>
      </footer>
    </div>
  );
}
