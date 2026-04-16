-- Create profiles table
CREATE TABLE IF NOT EXISTS public.yaara_profiles (
  mobile text PRIMARY KEY,
  name text NOT NULL,
  age text,
  gender text,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);