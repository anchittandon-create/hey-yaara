#!/bin/bash
# Hey Yaara - Complete System Check & Fix Script
# Run this in Supabase SQL Editor or via CLI

echo "========================================"
echo "Hey Yaara - Database & Storage Fix"
echo "========================================"

echo ""
echo "Running fixes..."

-- ============================================
-- FIX 1: Remove user_mobile constraint
-- ============================================
ALTER TABLE yaara_calls ALTER COLUMN user_mobile DROP NOT NULL;

-- ============================================
-- FIX 2: Storage Policies (allow all operations)
-- ============================================
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all read" ON storage.objects;

-- Create permissive policy for call-recordings bucket
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

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can read own messages" ON yaara_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON yaara_messages;
DROP POLICY IF EXISTS "Users can read own messages" ON yaara_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON yaara_messages;

-- Create permissive policies
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

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can read own calls" ON yaara_calls;
DROP POLICY IF EXISTS "Users can insert own calls" ON yaara_calls;

-- Create permissive policies
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

-- Check Storage Policies
SELECT 
  'Storage Policies' as category,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Check yaara_calls
SELECT 
  'yaara_calls RLS' as category,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'yaara_calls';

-- Check yaara_messages  
SELECT 
  'yaara_messages RLS' as category,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'yaara_messages';

echo ""
echo "========================================"
echo "All fixes applied successfully!"
echo "========================================"