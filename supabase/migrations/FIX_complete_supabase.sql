-- ============================================
-- Hey Yaara - Complete Database & Storage Fix
-- Copy and run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- FIX 1: Remove user_mobile constraint
-- ============================================
ALTER TABLE yaara_calls ALTER COLUMN user_mobile DROP NOT NULL;

-- ============================================
-- FIX 2: Storage Policies (allow all operations)
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all read" ON storage.objects;

CREATE POLICY "Allow all storage operations"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'call-recordings')
WITH CHECK (bucket_id = 'call-recordings');

-- ============================================
-- FIX 3: yaara_messages RLS
-- ============================================
ALTER TABLE yaara_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON yaara_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON yaara_messages;

CREATE POLICY "Allow all inserts yaara_messages"
ON yaara_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow all reads yaara_messages"
ON yaara_messages
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- FIX 4: yaara_calls RLS
-- ============================================
ALTER TABLE yaara_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own calls" ON yaara_calls;
DROP POLICY IF EXISTS "Users can insert own calls" ON yaara_calls;

CREATE POLICY "Allow all yaara_calls"
ON yaara_calls
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all insert yaara_calls"
ON yaara_calls
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow all update yaara_calls"
ON yaara_calls
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow all delete yaara_calls"
ON yaara_calls
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- Verify Fixes
-- ============================================
SELECT '✅ Fixes complete!' as status;

-- List all policies created
SELECT 
  'Storage Policies' as category,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

SELECT 
  'yaara_calls RLS' as category,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'yaara_calls';

SELECT 
  'yaara_messages RLS' as category,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'yaara_messages';