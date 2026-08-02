-- Freelancer/agency communication workspace metadata.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS main_service text,
  ADD COLUMN IF NOT EXISTS professional_bio text,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS common_services text,
  ADD COLUMN IF NOT EXISTS default_payment_terms text;

ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS workflow text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS client_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS message_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE public.email_history
  ADD CONSTRAINT email_history_workflow_check CHECK (workflow IN (
    'client_proposal', 'proposal_follow_up', 'project_update',
    'payment_reminder', 'revision_request', 'client_complaint', 'custom'
  ));

ALTER TABLE public.email_history
  ADD CONSTRAINT email_history_message_status_check CHECK (message_status IN (
    'draft', 'sent', 'awaiting_reply', 'replied', 'won', 'paid', 'closed'
  ));

CREATE INDEX IF NOT EXISTS email_history_user_workflow_idx
  ON public.email_history (user_id, workflow, created_at DESC);

CREATE INDEX IF NOT EXISTS email_history_user_status_idx
  ON public.email_history (user_id, message_status, created_at DESC);
