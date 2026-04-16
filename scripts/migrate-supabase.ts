import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = 'https://ovjphfywjonnjexpwjel.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anBoZnl3am9ubmpleHB3amVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTIwMDEsImV4cCI6MjA5MTA2ODAwMX0.7QIXGRO5G_fENUA_MDRVcq3LLxY0wlRTJr3TaNr5zbM';

const NEW_SUPABASE_URL = 'https://erijrcknzmjqvqttxdtm.supabase.co';
const NEW_SUPABASE_KEY = 'sb_publishable_WyL7MUCG1txY7i3vhNU7XQ_Qe8HKR74';

const oldClient = createSupabaseClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newClient = createSupabaseClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrate() {
  console.log('🚀 Starting migration from old Supabase to new Supabase...\n');

  // Fetch all profiles from old database
  console.log('📥 Fetching profiles from old database...');
  const { data: oldProfiles, error: profilesError } = await oldClient
    .from('yaara_profiles')
    .select('*');

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    return;
  }

  console.log(`   Found ${oldProfiles?.length || 0} profiles`);
  
  if (oldProfiles && oldProfiles.length > 0) {
    console.log('   Profiles:', oldProfiles.map(p => `${p.name} (${p.mobile})`).join(', '));
    
    // Insert profiles into new database
    console.log('\n📤 Inserting profiles into new database...');
    const { error: insertProfilesError } = await newClient
      .from('yaara_profiles')
      .upsert(oldProfiles, { onConflict: 'mobile' });

    if (insertProfilesError) {
      console.error('❌ Error inserting profiles:', insertProfilesError);
    } else {
      console.log('   ✅ Profiles migrated successfully');
    }
  }

  // Fetch all calls from old database
  console.log('\n📥 Fetching calls from old database...');
  const { data: oldCalls, error: callsError } = await oldClient
    .from('yaara_calls')
    .select('*');

  if (callsError) {
    console.error('❌ Error fetching calls:', callsError);
    return;
  }

  console.log(`   Found ${oldCalls?.length || 0} calls`);

  if (oldCalls && oldCalls.length > 0) {
    // Insert calls into new database
    console.log('\n📤 Inserting calls into new database...');
    const { error: insertCallsError } = await newClient
      .from('yaara_calls')
      .upsert(oldCalls, { onConflict: 'id' });

    if (insertCallsError) {
      console.error('❌ Error inserting calls:', insertCallsError);
    } else {
      console.log('   ✅ Calls migrated successfully');
    }
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  
  const { data: newProfiles } = await newClient.from('yaara_profiles').select('*');
  const { data: newCalls } = await newClient.from('yaara_calls').select('*');

  console.log(`   New database now has ${newProfiles?.length || 0} profiles`);
  console.log(`   New database now has ${newCalls?.length || 0} calls`);

  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);