import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = 'https://erijrcknzmjqvqttxdtm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWpyY2tuem1qcXZxdHR4ZHRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMxMjc2NSwiZXhwIjoyMDkxODg4NzY1fQ.XdhqyxwN4mqZVM0_VRwwGiozGjrlvmquwSoOrJzZ4BE';

async function createTables() {
  console.log('🔧 Creating tables via direct PostgreSQL connection...\n');

  // Supabase provides a direct PostgreSQL connection
  // Connection string format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
  // But we need to get the password from somewhere...
  
  // Alternative: Use the REST API to enable the "exec_sql" extension
  // Or try using the supabase-js with a different approach

  // Let's check if there's a different way - maybe via the transaction API
  console.log('Trying alternative approaches...\n');

  // Approach: Use fetch to call the management API
  // The management API can create tables but requires project API key
  
  // Try the schema force-refresh approach
  const client = await import('@supabase/supabase-js');
  const supabase = client.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Try creating via "alter schema" to force cache refresh
  console.log('1. Testing schema access...');
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);
    
    console.log('   Result:', error?.message || `found ${data?.length || 0} tables`);
  } catch (e: any) {
    console.log('   Error:', e.message.slice(0, 100));
  }

  // Try using the "alter schema" to reload
  console.log('\n2. Trying schema reload...');
  
  // The service role should bypass postgREST - let's try raw query
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Accept': 'application/json'
    }
  });
  console.log('   REST API status:', response.status);

  // Final option: the tables might need to be enabled via the UI
  console.log('\n❌ Tables cannot be created via API.');
  console.log('\n📋 Please run this in Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/erijrcknzmjqvqttxdtm/sql-editor\n');
  console.log('SQL to run:');
  console.log(`
CREATE TABLE IF NOT EXISTS public.yaara_profiles (
  mobile text PRIMARY KEY,
  name text NOT NULL,
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

createTables().catch(console.error);