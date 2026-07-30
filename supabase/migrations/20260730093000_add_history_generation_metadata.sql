ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS parent_history_id uuid REFERENCES public.email_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_version integer NOT NULL DEFAULT 1 CHECK (generation_version >= 1),
  ADD COLUMN IF NOT EXISTS revision_action text,
  ADD COLUMN IF NOT EXISTS template text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS requested_length text;

CREATE INDEX IF NOT EXISTS email_history_user_created_at_idx
  ON public.email_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_history_parent_history_id_idx
  ON public.email_history (parent_history_id);
