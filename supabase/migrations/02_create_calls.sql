-- Create calls table
CREATE TABLE IF NOT EXISTS public.yaara_calls (
  id text PRIMARY KEY,
  user_mobile text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration integer DEFAULT 0,
  status text DEFAULT 'completed',
  transcript jsonb DEFAULT '[]',
  audio_blob text,
  updated_at timestamptz NOT NULL DEFAULT now()
);