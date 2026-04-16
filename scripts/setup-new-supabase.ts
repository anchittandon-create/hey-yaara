import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://erijrcknzmjqvqttxdtm.supabase.co';
const NEW_SUPABASE_KEY = 'sb_publishable_WyL7MUCG1txY7i3vhNU7XQ_Qe8HKR74';

const newClient = createSupabaseClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function setupAndMigrate() {
  console.log('🔧 Setting up data in new Supabase...\n');

  // Insert the main profile (Anchit Tandon)
  console.log('📤 Inserting Anchit Tandon profile...');
  const { error: profileError } = await newClient
    .from('yaara_profiles')
    .upsert({
      mobile: '9873945238',
      name: 'Anchit Tandon',
      updated_at: new Date().toISOString()
    }, { onConflict: 'mobile' });

  if (profileError) {
    console.error('❌ Error inserting profile:', profileError.message);
  } else {
    console.log('   ✅ Profile inserted\n');
  }

  // Check if there's any existing data
  const { data: existingProfiles, error: fetchProfilesError } = await newClient.from('yaara_profiles').select('*');
  const { data: existingCalls, error: fetchCallsError } = await newClient.from('yaara_calls').select('*');

  console.log('📊 Current data in new Supabase:');
  console.log(`   Profiles: ${existingProfiles?.length || 0}`);
  console.log(`   Calls: ${existingCalls?.length || 0}`);

  if (existingProfiles) {
    console.log('\n   Profile data:');
    existingProfiles.forEach(p => console.log(`   - ${p.name} (${p.mobile})`));
  }

  if (existingCalls) {
    console.log(`\n   ${existingCalls.length} call records found`);
  }

  console.log('\n✅ Setup complete!');
}

setupAndMigrate().catch(console.error);