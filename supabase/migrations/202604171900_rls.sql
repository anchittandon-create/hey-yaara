-- RLS policies for yaara tables
ALTER TABLE yaara_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yaara_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles" ON yaara_profiles;
CREATE POLICY "Anyone can read profiles" ON yaara_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert profile" ON yaara_profiles;
CREATE POLICY "Anyone can insert profile" ON yaara_profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update profile" ON yaara_profiles;
CREATE POLICY "Anyone can update profile" ON yaara_profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can read calls" ON yaara_calls;
CREATE POLICY "Anyone can read calls" ON yaara_calls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert calls" ON yaara_calls;
CREATE POLICY "Anyone can insert calls" ON yaara_calls FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update calls" ON yaara_calls;
CREATE POLICY "Anyone can update calls" ON yaara_calls FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete calls" ON yaara_calls;
CREATE POLICY "Anyone can delete calls" ON yaara_calls FOR DELETE USING (true);