import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://erijrcknzmjqvqttxdtm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WyL7MUCG1txY7i3vhNU7XQ_Qe8HKR74';

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function createTables() {
  console.log('🔧 Creating tables in Supabase...\n');

  // Try using direct fetch with proper headers
  const createTable = async (tableName: string, columns: string) => {
    const sql = `CREATE TABLE IF NOT EXISTS public.${tableName} (${columns});`;
    console.log(`Creating ${tableName}...`);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ sql })
    });
    
    console.log(`   Response: ${response.status}`);
    if (!response.ok) {
      const err = await response.text();
      console.log(`   Error: ${err.slice(0, 200)}`);
    }
    return response.ok;
  };

  // Try to create tables using the pg_run_sql function or similar
  console.log('Attempting table creation...');

  // First, let's see if we can query anything
  console.log('\n1. Testing basic connectivity...');
  try {
    // Reset the client schema cache by creating a new one
    const testClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await testClient.from('postgres_tables').select('tablename').limit(1);
    console.log('   Query result:', error?.message || 'success');
  } catch (e: any) {
    console.log('   Error:', e.message);
  }

  // Try direct SQL execution via HTTP
  console.log('\n2. Trying direct SQL via HTTP...');
  const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({
      query: 'SELECT 1 as test'
    })
  });
  console.log('   SQL exec response:', sqlResponse.status, sqlResponse.statusText);

  // Check current tables using a workaround
  console.log('\n3. Checking current state...');
  try {
    // Try to insert - if table doesn't exist, we'll get clear error
    await client.from('yaara_profiles').insert({
      mobile: 'test',
      name: 'test'
    });
    console.log('   Table exists!');
  } catch (e: any) {
    console.log('   Error:', e.message);
    if (e.message.includes('Could not find the table')) {
      console.log('\n❌ Tables do not exist in this Supabase project.');
      console.log('   The project is empty and needs tables created.');
      console.log('\n   Please run this SQL in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/erijrcknzmjqvqttxdtm/sql-editor');
    }
  }
}

createTables().catch(console.error);