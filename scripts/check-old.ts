import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://dmiuqprwjyuvfqviqlsh.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtaXVxcHJ3anl1dmZxdmlxbHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk1MzIxMywiZXhwIjoyMDg5NTI5MjEzfQ.D1q8BxSYCNZwkDFQUlGqUAHsHo3Hbaz7Wz74CE5P4xM';

const client = createClient(OLD_URL, OLD_SERVICE_KEY);

async function checkOldData() {
  console.log('Checking OLD Supabase project for data...\n');

  try {
    const { data: profiles } = await client.from('yaara_profiles').select('*');
    console.log(`Profiles: ${profiles?.length || 0}`);
    if (profiles && profiles.length > 0) {
      profiles.forEach(p => console.log(`  - ${p.name} (${p.mobile})`));
    }
  } catch (e: any) {
    console.log(`Profiles error: ${e.message}`);
  }

  try {
    const { data: calls } = await client.from('yaara_calls').select('*');
    console.log(`Calls: ${calls?.length || 0}`);
    if (calls && calls.length > 0) {
      calls.forEach(c => console.log(`  - ${c.id}: ${c.duration}s`));
    }
  } catch (e: any) {
    console.log(`Calls error: ${e.message}`);
  }
}

checkOldData();