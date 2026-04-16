import { createClient } from '@supabase/supabase-js';

// This script attempts to create tables in Supabase using the service role key
// The service role key bypasses RLS but still goes through postgREST

const SUPABASE_URL = 'https://dmiuqprwjyuvfqviqlsh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtaXVxcHJ3anl1dmZxdmlxbHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk1MzIxMywiZXhwIjoyMDg5NTI5MjEzfQ.D1q8BxSYCNZwkDFQUlGqUAHsHo3Hbaz7Wz74CE5P4xM';

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('🔧 Creating Supabase tables...\n');

  // Try to insert directly - this will fail if tables don't exist but will give us the error
  console.log('Attempting to insert into yaara_profiles...');
  const { error: insertError } = await client
    .from('yaara_profiles')
    .insert({
      mobile: '9873945238',
      name: 'Anchit Tandon',
      updated_at: new Date().toISOString()
    });

  if (insertError) {
    console.log(`   Error: ${insertError.message}`);
    
    if (insertError.message.includes('Could not find the table')) {
      console.log('\n❌ Tables do not exist. Need to create them manually.');
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log('https://supabase.com/dashboard/project/dmiuqprwjyuvfqviqlsh/sql-editor');
      console.log('\nSQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS public.yaara_profiles (
  mobile text PRIMARY KEY,
  name text NOT NULL,
  age text,
  gender text,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

ALTER TABLE public.yaara_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.yaara_calls DISABLE ROW LEVEL SECURITY;

INSERT INTO public.yaara_profiles (mobile, name) VALUES ('9873945238', 'Anchit Tandon');
      `.trim());
    }
  } else {
    console.log('   ✅ Profile inserted!');
  }

  // Try calls table
  console.log('\nAttempting to insert into yaara_calls...');
  const { error: callsError } = await client
    .from('yaara_calls')
    .insert({
      id: 'test-call-1',
      user_mobile: '9873945238',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration: 0,
      status: 'completed'
    });

  if (callsError) {
    console.log(`   Error: ${callsError.message}`);
  } else {
    console.log('   ✅ Call inserted!');
  }

  // Final check
  console.log('\n📊 Checking database...');
  const { data: profiles } = await client.from('yaara_profiles').select('*');
  const { data: calls } = await client.from('yaara_calls').select('*');
  
  console.log(`   Profiles: ${profiles?.length || 0}`);
  console.log(`   Calls: ${calls?.length || 0}`);

  if (profiles && profiles.length > 0) {
    console.log('\n✅ Database is ready!');
  }
}

main().catch(console.error);