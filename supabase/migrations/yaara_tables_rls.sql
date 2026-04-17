-- yaara_tables_rls.sql
-- Run: npx supabase db push --project-ref erijrcknzmjqvqttxdtm

-- Enable RLS on yaara_profiles
ALTER TABLE yaara_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read profiles
DROP POLICY IF EXISTS "Anyone can read profiles" ON yaara_profiles;
CREATE POLICY "Anyone can read profiles" ON yaara_profiles
  FOR SELECT USING (true);

-- Policy: Anyone can insert profile
DROP POLICY IF EXISTS "Anyone can insert profile" ON yaara_profiles;
CREATE POLICY "Anyone can insert profile" ON yaara_profiles
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update profile
DROP POLICY IF EXISTS "Anyone can update profile" ON yaara_profiles;
CREATE POLICY "Anyone can update profile" ON yaara_profiles
  FOR UPDATE USING (true);

-- Enable RLS on yaara_calls
ALTER TABLE yaara_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read calls
DROP POLICY IF EXISTS "Anyone can read calls" ON yaara_calls;
CREATE POLICY "Anyone can read calls" ON yaara_calls
  FOR SELECT USING (true);

-- Policy: Anyone can insert calls
DROP POLICY IF EXISTS "Anyone can insert calls" ON yaara_calls;
CREATE POLICY "Anyone can insert calls" ON yaara_calls
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update calls
DROP POLICY IF EXISTS "Anyone can update calls" ON yaara_calls;
CREATE POLICY "Anyone can update calls" ON yaara_calls
  FOR UPDATE USING (true);

-- Policy: Anyone can delete calls
DROP POLICY IF EXISTS "Anyone can delete calls" ON yaara_calls;
CREATE POLICY "Anyone can delete calls" ON yaara_calls
  FOR DELETE USING (true);