-- Extend profiles for the email SaaS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS default_role text,
  ADD COLUMN IF NOT EXISTS default_signature text;

-- =========================================================
-- PLANS (public catalog of subscription tiers)
-- =========================================================
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  price_egp integer NOT NULL DEFAULT 0,
  paymob_amount_cents integer NOT NULL DEFAULT 0,
  monthly_quota integer NOT NULL DEFAULT 0,
  features_en text[] NOT NULL DEFAULT '{}',
  features_ar text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SUBSCRIPTIONS (one active row per user; written server-side)
-- =========================================================
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  paymob_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_user_id_key ON public.subscriptions(user_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users may read their own subscription, but never write it (server-only)
CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- USAGE COUNTERS (per user per monthly period)
-- =========================================================
CREATE TABLE public.usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  emails_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage"
  ON public.usage_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- EMAIL HISTORY (generated emails)
-- =========================================================
CREATE TABLE public.email_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'compose',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject text,
  body text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  tone text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_history TO authenticated;
GRANT ALL ON public.email_history TO service_role;
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email history"
  ON public.email_history FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- SNIPPETS (reusable context blocks)
-- =========================================================
CREATE TABLE public.snippets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.snippets TO authenticated;
GRANT ALL ON public.snippets TO service_role;
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own snippets"
  ON public.snippets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- updated_at triggers (function already exists)
-- =========================================================
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_history_updated_at BEFORE UPDATE ON public.email_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_snippets_updated_at BEFORE UPDATE ON public.snippets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Seed the default plan catalog
-- =========================================================
INSERT INTO public.plans (slug, name_en, name_ar, description_en, description_ar, price_egp, paymob_amount_cents, monthly_quota, features_en, features_ar, sort_order)
VALUES
  ('free', 'Free', 'مجاني', 'Get started at no cost', 'ابدأ مجانًا', 0, 0, 15,
    ARRAY['15 emails / month','Compose & reply modes','Arabic & English','Email history'],
    ARRAY['15 رسالة شهريًا','وضع الإنشاء والرد','العربية والإنجليزية','سجل الرسائل'], 1),
  ('pro', 'Pro', 'احترافي', 'For professionals who email daily', 'للمحترفين الذين يرسلون يوميًا', 199, 19900, 500,
    ARRAY['500 emails / month','All tones & lengths','Saved snippets','Priority generation','Export options'],
    ARRAY['500 رسالة شهريًا','جميع النبرات والأطوال','المقاطع المحفوظة','توليد ذو أولوية','خيارات التصدير'], 2),
  ('business', 'Business', 'الأعمال', 'Maximum power for heavy senders', 'أقصى قوة للمرسلين بكثافة', 499, 49900, 3000,
    ARRAY['3000 emails / month','Everything in Pro','Unlimited snippets','Early access to new features'],
    ARRAY['3000 رسالة شهريًا','كل ميزات الاحترافي','مقاطع غير محدودة','وصول مبكر للميزات الجديدة'], 3);