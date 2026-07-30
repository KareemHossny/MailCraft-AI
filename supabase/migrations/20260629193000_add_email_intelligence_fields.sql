ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subject_lines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quality_score jsonb NOT NULL DEFAULT '{}'::jsonb;
