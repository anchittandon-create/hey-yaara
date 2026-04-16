import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/contexts/AuthContext";
import type { CallRecord } from "@/lib/call-storage";

const PROFILE_TABLE = "yaara_profiles";
const CALLS_TABLE = "yaara_calls";

const getClient = () => supabase as any;

export const isCloudSyncAvailable = () =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

export const normalizeMobileKey = (mobile?: string | null) =>
  mobile?.replace(/\D/g, "").trim() ?? "";

const safeProfile = (row: Record<string, unknown>): AuthUser => ({
  name: String(row.name ?? ""),
  mobile: String(row.mobile ?? ""),
  age: typeof row.age === "string" ? row.age : undefined,
  gender: typeof row.gender === "string" ? row.gender : undefined,
  email: typeof row.email === "string" ? row.email : undefined,
  yaaraFemaleVoiceId: typeof row.yaara_female_voice_id === "string" ? row.yaara_female_voice_id : undefined,
  yaarMaleVoiceId: typeof row.yaar_male_voice_id === "string" ? row.yaar_male_voice_id : undefined,
  updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
});

const safeCall = (row: Record<string, unknown>): CallRecord => ({
  id: String(row.id),
  userMobile: typeof row.user_mobile === "string" ? row.user_mobile : undefined,
  startTime: String(row.start_time ?? ""),
  endTime: String(row.end_time ?? ""),
  duration: Number(row.duration ?? 0),
  status: String(row.status ?? "completed"),
  transcript: Array.isArray(row.transcript) ? row.transcript as CallRecord["transcript"] : [],
  audioBlob: typeof row.audio_blob === "string" ? row.audio_blob : null,
  updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
});

export const fetchRemoteProfile = async (mobile: string): Promise<AuthUser | null> => {
  const normalizedMobile = normalizeMobileKey(mobile);
  if (!isCloudSyncAvailable() || !normalizedMobile) return null;

  const { data, error } = await getClient()
    .from(PROFILE_TABLE)
    .select("*")
    .eq("mobile", normalizedMobile)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return safeProfile(data);
};

export const upsertRemoteProfile = async (profile: AuthUser): Promise<void> => {
  const normalizedMobile = normalizeMobileKey(profile.mobile);
  if (!isCloudSyncAvailable() || !normalizedMobile) return;

  const payload = {
    mobile: normalizedMobile,
    name: profile.name,
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    email: profile.email ?? null,
    yaara_female_voice_id: profile.yaaraFemaleVoiceId ?? null,
    yaar_male_voice_id: profile.yaarMaleVoiceId ?? null,
    updated_at: profile.updatedAt ?? new Date().toISOString(),
  };

  const { error } = await getClient().from(PROFILE_TABLE).upsert(payload, { onConflict: "mobile" });
  if (error) throw error;
};

export const fetchRemoteCalls = async (mobile: string): Promise<CallRecord[]> => {
  const normalizedMobile = normalizeMobileKey(mobile);
  if (!isCloudSyncAvailable() || !normalizedMobile) return [];

  const { data, error } = await getClient()
    .from(CALLS_TABLE)
    .select("*")
    .eq("user_mobile", normalizedMobile)
    .order("start_time", { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data.map((row: Record<string, unknown>) => safeCall(row)) : [];
};

export const upsertRemoteCall = async (call: CallRecord): Promise<void> => {
  const normalizedMobile = normalizeMobileKey(call.userMobile);
  if (!isCloudSyncAvailable() || !normalizedMobile) return;

  const payload = {
    id: call.id,
    user_mobile: normalizedMobile,
    start_time: call.startTime,
    end_time: call.endTime,
    duration: call.duration,
    status: call.status,
    transcript: call.transcript,
    audio_blob: call.audioBlob,
    updated_at: call.updatedAt ?? new Date().toISOString(),
  };

  const { error } = await getClient().from(CALLS_TABLE).upsert(payload, { onConflict: "id" });
  if (error) throw error;
};

export const deleteRemoteCall = async (id: string, mobile: string): Promise<void> => {
  const normalizedMobile = normalizeMobileKey(mobile);
  if (!isCloudSyncAvailable() || !normalizedMobile) return;

  const { error } = await getClient()
    .from(CALLS_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_mobile", normalizedMobile);

  if (error) throw error;
};

/**
 * Find all mobile numbers registered with a certain name.
 * Used for merging 'Anchit Tandon' accounts.
 */
export const findMobilesByName = async (name: string): Promise<string[]> => {
  if (!isCloudSyncAvailable() || !name) return [];
  const { data, error } = await getClient()
    .from(PROFILE_TABLE)
    .select("mobile")
    .ilike("name", `%${name}%`);
  if (error) {
    console.warn("[CloudSync] findMobilesByName failed:", error);
    return [];
  }
  return Array.isArray(data) ? data.map(d => String(d.mobile)) : [];
};

/**
 * Fetch all profiles with similar names and return all their mobiles.
 */
export const getAllMobilesByName = async (name: string): Promise<string[]> => {
  if (!isCloudSyncAvailable() || !name) return [];
  
  const normalized = name.trim().toLowerCase();
  let searchName = normalized;
  if (!normalized.includes("anchit")) {
    searchName = `anchit ${normalized}`;
  }
  
  const { data, error } = await getClient()
    .from(PROFILE_TABLE)
    .select("mobile")
    .or(`name.ilike.%anchit%,name.ilike.%${searchName}%`);
  
  if (error) {
    console.warn("[CloudSync] getAllMobilesByName failed:", error);
    return [];
  }
  
  return Array.isArray(data) ? data.map(d => normalizeMobileKey(d.mobile)).filter(Boolean) : [];
};

/**
 * Fetch all profiles and merge those with similar names.
 * Used for merging 'Anchit Tandon' profiles across multiple numbers.
 */
export const fetchAndMergeProfilesByName = async (name: string): Promise<AuthUser | null> => {
  if (!isCloudSyncAvailable() || !name) return null;
  
  const allMobiles = await getAllMobilesByName(name);
  console.log("[CloudSync] All mobiles for profile merge:", allMobiles);
  
  if (allMobiles.length === 0) return null;
  
  const profiles: AuthUser[] = [];
  for (const mobile of allMobiles) {
    try {
      const profile = await fetchRemoteProfile(mobile);
      if (profile) profiles.push(profile);
    } catch (err) {
      console.warn(`[CloudSync] Failed to fetch profile for ${mobile}:`, err);
    }
  }
  
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];
  
  const sorted = profiles.sort((a, b) => {
    const aTime = new Date(a.updatedAt || 0).getTime();
    const bTime = new Date(b.updatedAt || 0).getTime();
    return bTime - aTime;
  });
  
  const merged: AuthUser = { ...sorted[0] };
  merged.mobile = allMobiles.join(',');
  
  return merged;
};

/**
 * Fetch ALL profiles from the cloud and merge them all.
 * Used when we want to merge ALL users into one (regardless of name).
 */
export const fetchAllProfiles = async (): Promise<AuthUser[]> => {
  if (!isCloudSyncAvailable()) return [];
  
  const { data, error } = await getClient()
    .from(PROFILE_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  
  if (error) {
    console.warn("[CloudSync] fetchAllProfiles failed:", error);
    return [];
  }
  
  return Array.isArray(data) ? data.map(d => safeProfile(d)) : [];
};

/**
 * Fetch all call records from ALL users to merge into one view.
 */
export const fetchAllCallsFromAllUsers = async (): Promise<CallRecord[]> => {
  if (!isCloudSyncAvailable()) return [];
  
  const { data, error } = await getClient()
    .from(CALLS_TABLE)
    .select("*")
    .order("start_time", { ascending: false });
  
  if (error) {
    console.warn("[CloudSync] fetchAllCallsFromAllUsers failed:", error);
    return [];
  }
  
  return Array.isArray(data) ? data.map(d => safeCall(d)) : [];
};

