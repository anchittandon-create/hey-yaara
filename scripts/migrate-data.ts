import { createClient } from '@supabase/supabase-js';

// Old project (might have existing data)
const OLD_URL = 'https://dmiuqprwjyuvfqviqlsh.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtaXVxcHJ3anl1dmZxdmlxbHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk1MzIxMywiZXhwIjoyMDg5NTI5MjEzfQ.D1q8BxSYCNZwkDFQUlGqUAHsHo3Hbaz7Wz74CE5P4xM';

// New project (where we'll set up tables)
const NEW_URL = 'https://erijrcknzmjqvqttxdtm.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWpyY2tuem1qcXZxdHR4ZHRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMxMjc2NSwiZXhwIjoyMDkxODg4NzY1fQ.XdhqyxwN4mqZVM0_VRwwGiozGjrlvmquwSoOrJzZ4BE';

const oldClient = createClient(OLD_URL, OLD_SERVICE_KEY);
const newClient = createClient(NEW_URL, NEW_SERVICE_KEY);

async function migrate() {
  console.log('🔄 Migrating data from old Supabase to new Supabase...\n');

  // Step 1: Check old project for existing data
  console.log('1. Checking OLD project for data...');
  let oldProfiles = [];
  let oldCalls = [];

  try {
    const { data: profiles } = await oldClient.from('yaara_profiles').select('*');
    oldProfiles = profiles || [];
    console.log(`   Profiles found: ${oldProfiles.length}`);
  } catch (e) {
    console.log('   No profiles table in old project');
  }

  try {
    const { data: calls } = await oldClient.from('yaara_calls').select('*');
    oldCalls = calls || [];
    console.log(`   Calls found: ${oldCalls.length}`);
  } catch (e) {
    console.log('   No calls table in old project');
  }

  if (oldProfiles.length > 0) {
    console.log('\n   Existing profiles:');
    oldProfiles.forEach(p => console.log(`   - ${p.name} (${p.mobile})`));
  }

  // Step 2: Try to create tables in new project and migrate data
  console.log('\n2. Setting up NEW project...');

  // Insert profile
  const { error: profileError } = await newClient
    .from('yaara_profiles')
    .upsert({
      mobile: '9873945238',
      name: 'Anchit Tandon',
      updated_at: new Date().toISOString()
    }, { onConflict: 'mobile' });

  if (profileError && profileError.message.includes('Could not find the table')) {
    console.log('   ❌ Tables do not exist in new project');
    console.log('\n   Please create tables manually in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/erijrcknzmjqvqttxdtm/sql-editor');
  } else if (!profileError) {
    console.log('   ✅ Profile created!');
  }

  // Step 3: Migrate old data to new project
  console.log('\n3. Migrating old data...');

  if (oldProfiles.length > 0) {
    for (const profile of oldProfiles) {
      // Normalize mobile to ensure consistency
      const normalizedMobile = profile.mobile.replace(/\D/g, '');
      
      await newClient.from('yaara_profiles').upsert({
        ...profile,
        mobile: normalizedMobile
      }, { onConflict: 'mobile' });
    }
    console.log(`   ✅ Migrated ${oldProfiles.length} profiles`);
  }

  if (oldCalls.length > 0) {
    for (const call of oldCalls) {
      const normalizedMobile = call.user_mobile?.replace(/\D/g, '') || '';
      await newClient.from('yaara_calls').upsert({
        ...call,
        user_mobile: normalizedMobile
      }, { onConflict: 'id' });
    }
    console.log(`   ✅ Migrated ${oldCalls.length} calls`);
  }

  // Step 4: Verify
  console.log('\n4. Verifying new database...');
  const { data: newProfiles } = await newClient.from('yaara_profiles').select('*');
  const { data: newCalls } = await newClient.from('yaara_calls').select('*');

  console.log(`   Profiles: ${newProfiles?.length || 0}`);
  console.log(`   Calls: ${newCalls?.length || 0}`);

  if (newProfiles) {
    newProfiles.forEach(p => console.log(`   - ${p.name} (${p.mobile})`));
  }

  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);