-- Hey Yaara Database Setup
-- Run this in Supabase Dashboard → SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.yaara_profiles (
  mobile text PRIMARY KEY,
  name text NOT NULL,
  age text,
  gender text,
  email text,
  yaara_female_voice_id text,
  yaar_male_voice_id text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create calls table
CREATE TABLE IF NOT EXISTS public.yaara_calls (
  id text PRIMARY KEY,
  user_mobile text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_blob text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create index
CREATE INDEX IF NOT EXISTS yaara_calls_user_mobile_idx ON public.yaara_calls(user_mobile, start_time desc);

-- Disable row level security
ALTER TABLE public.yaara_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.yaara_calls DISABLE ROW LEVEL SECURITY;

-- Insert Anchit Tandon profile
INSERT INTO public.yaara_profiles (mobile, name, updated_at)
VALUES ('9873945238', 'Anchit Tandon', NOW())
ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name;