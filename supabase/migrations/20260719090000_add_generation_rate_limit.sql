CREATE TABLE IF NOT EXISTS public.generation_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_generation_rate_limit(
  p_user_id uuid,
  p_max_requests integer DEFAULT 6,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_limit public.generation_rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO current_limit
  FROM public.generation_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.generation_rate_limits (user_id, request_count)
    VALUES (p_user_id, 1);
    RETURN true;
  END IF;

  IF current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.generation_rate_limits
    SET window_started_at = now(), request_count = 1, updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  IF current_limit.request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  UPDATE public.generation_rate_limits
  SET request_count = request_count + 1, updated_at = now()
  WHERE user_id = p_user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_generation_rate_limit(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_generation_rate_limit(uuid, integer, integer) TO service_role;
