ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS preferred_pronouns text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS preferred_greeting text,
  ADD COLUMN IF NOT EXISTS default_cta text,
  ADD COLUMN IF NOT EXISTS default_sign_off text;
