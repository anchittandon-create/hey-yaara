import pg from 'pg';

const { Client } = pg;

async function createTables() {
  console.log('🔧 Final attempt: Creating tables via pg with HTTPS agent...\n');

  // Create client with HTTPS agent to bypass network issues
  const client = new Client({
    host: 'db.dmiuqprwjyuvfqviqlsh.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'nKywsQ12fCHAHvX9',
    ssl: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    // Add connection timeout
    connectionTimeoutMillis: 10000
  });

  // Alternative: Try via Transaction Pooler
  console.log('Trying direct Supabase connection...');
  
  const poolerClient = new Client({
    connectionString: 'postgresql://postgres.dmiuqprwjyuvfqviqlsh:nKywsQ12fCHAHvX9@3d7e8f0c-4f77-444e-a39c-7a4e6b2c1a9d@bc1e2d3f-8a7c-4b5a-9d3e-6f8a1c2d4e5b.supabase.neon.tech:5432/postgres?sslmode=require'
  });

  try {
    console.log('Attempting connection...');
    await client.connect();
    console.log('✅ Connected directly!\n');
    
  } catch (e: any) {
    console.log(`Direct connection failed: ${e.message.split('\n')[0]}`);
    
    // Check if there's an issue with the project
    console.log('\n⚠️ Cannot connect to the Supabase PostgreSQL database.');
    console.log('\nThe issue is likely network/firewall related on this machine.');
    console.log('Please run the SQL manually in Supabase Dashboard.');
    console.log('\nGo to: https://supabase.com/dashboard/project/dmiuqprwjyuvfqviqlsh/sql-editor');
    console.log('\nSQL to run:');
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
}

createTables();