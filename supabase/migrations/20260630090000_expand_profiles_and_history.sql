ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS preferred_signature text,
  ADD COLUMN IF NOT EXISTS default_tone text NOT NULL DEFAULT 'formal',
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'en';

ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy jsonb NOT NULL DEFAULT '{}'::jsonb;
