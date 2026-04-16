-- Create tables for Hey Yaara app

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.yaara_profiles (
  mobile text PRIMARY KEY,
  name text NOT NULL,
  age text,
  gender text,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- Disable Row Level Security
ALTER TABLE public.yaara_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.yaara_calls DISABLE ROW LEVEL SECURITY;

-- Insert default profile
INSERT INTO public.yaara_profiles (mobile, name, updated_at)
VALUES ('9873945238', 'Anchit Tandon', NOW())
ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name;