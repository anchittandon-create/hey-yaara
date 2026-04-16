-- Disable Row Level Security
ALTER TABLE public.yaara_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.yaara_calls DISABLE ROW LEVEL SECURITY;

-- Insert default profile
INSERT INTO public.yaara_profiles (mobile, name, updated_at)
VALUES ('9873945238', 'Anchit Tandon', NOW())
ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name;