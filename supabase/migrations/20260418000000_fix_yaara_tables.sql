-- Ensure yaara_calls table exists (adjust if your schema differs)
CREATE TABLE IF NOT EXISTS yaara_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  audio_path TEXT,
  transcript TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure yaara_messages table exists
CREATE TABLE IF NOT EXISTS yaara_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES yaara_calls(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on yaara_calls
ALTER TABLE yaara_calls ENABLE ROW LEVEL SECURITY;

-- Enable RLS on yaara_messages
ALTER TABLE yaara_messages ENABLE ROW LEVEL SECURITY;

-- Policies for yaara_calls
DROP POLICY IF EXISTS "Users can read own calls" ON yaara_calls;
CREATE POLICY "Users can read own calls"
  ON yaara_calls
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calls" ON yaara_calls;
CREATE POLICY "Users can insert own calls"
  ON yaara_calls
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own calls" ON yaara_calls;
CREATE POLICY "Users can update own calls"
  ON yaara_calls
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calls" ON yaara_calls;
CREATE POLICY "Users can delete own calls"
  ON yaara_calls
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for yaara_messages
DROP POLICY IF EXISTS "Users can read own messages" ON yaara_messages;
CREATE POLICY "Users can read own messages"
  ON yaara_messages
  FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM yaara_calls
      WHERE yaara_calls.id = yaara_messages.call_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own messages" ON yaara_messages;
CREATE POLICY "Users can insert own messages"
  ON yaara_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM yaara_calls
      WHERE yaara_calls.id = yaara_messages.call_id
    )
  );
