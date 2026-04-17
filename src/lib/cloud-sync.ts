import { supabase } from "@/integrations/supabase/client";
import type { CallRecord } from "@/lib/call-storage";

const CALLS_TABLE = "yaara_calls";
const STORAGE_BUCKET = "call-recordings";

const DEMO_USER_ID = "f51fd26c-dc4e-4a0e-b7d6-75e47639c159";

async function getUserId(): Promise<string> {
  return DEMO_USER_ID;
}

export const fetchUserCalls = async (limit = 50, offset = 0): Promise<CallRecord[]> => {
  try {
    const userId = await getUserId();
    console.log("[CloudSync] Fetching calls for userId:", userId, "limit:", limit, "offset:", offset);
    
    const { data, error } = await supabase
      .from(CALLS_TABLE)
      .select("id,start_time,end_time,duration,status,user_mobile,user_id,updated_at,audio_path")
      .eq("user_id", userId)
      .order("start_time", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error("[CloudSync] fetchUserCalls error:", error);
      return [];
    }
    
    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      userMobile: row.user_mobile,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      status: row.status,
      transcript: [],
      audioBlob: null,
      audioPath: row.audio_path || null,
      updatedAt: row.updated_at,
    }));
    
    console.log("[CloudSync] Calls fetched:", mapped.length);
    return mapped;
  } catch (err) {
    console.error("[CloudSync] fetchUserCalls exception:", err);
    return [];
  }
};

export const getAudioSignedUrl = async (path: string): Promise<string | null> => {
  try {
    if (!path) return null;
    
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    
    if (error) {
      console.error("[CloudSync] getAudioSignedUrl error:", error);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (err) {
    console.error("[CloudSync] getAudioSignedUrl exception:", err);
    return null;
  }
};

export const fetchCallAudio = async (callId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from(CALLS_TABLE)
      .select("audio_path")
      .eq("id", callId)
      .single();
    
    if (error || !data?.audio_path) {
      console.log("[CloudSync] No audio_path found for call:", callId);
      return null;
    }
    
    return getAudioSignedUrl(data.audio_path);
  } catch (err) {
    console.error("[CloudSync] fetchCallAudio exception:", err);
    return null;
  }
};

export const uploadAudio = async (callId: string, audioBlob: Blob): Promise<string | null> => {
  try {
    const path = `${callId}.webm`;
    
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(path, audioBlob, {
        upsert: true,
        contentType: "audio/webm",
      });
    
    if (error) {
      console.error("[CloudSync] uploadAudio error:", error);
      return null;
    }
    
    await supabase
      .from(CALLS_TABLE)
      .update({ audio_path: path })
      .eq("id", callId);
    
    return path;
  } catch (err) {
    console.error("[CloudSync] uploadAudio exception:", err);
    return null;
  }
};

export const insertCall = async (callData: any) => {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from(CALLS_TABLE)
      .insert([
        {
          ...callData,
          user_id: userId,
        },
      ])
      .select();
    
    if (error) {
      console.error("[CloudSync] insertCall error:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[CloudSync] insertCall exception:", err);
    return null;
  }
};

export const deleteCall = async (callId: string) => {
  try {
    const userId = await getUserId();
    const { error } = await supabase
      .from(CALLS_TABLE)
      .delete()
      .eq("id", callId)
      .eq("user_id", userId);
    
    if (error) {
      console.error("[CloudSync] deleteCall error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[CloudSync] deleteCall exception:", err);
    return false;
  }
};

export const isCloudSyncAvailable = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const available = Boolean(url && key);
  console.log("[CloudSync] Checking availability:", { 
    url: url || "NOT_SET", 
    key: key ? "set" : "NOT_SET",
    available 
  });
  return available;
};

export const normalizeMobileKey = (mobile?: string | null) =>
  mobile?.replace(/\D/g, "").trim() ?? "";

export const fetchRemoteProfile = async (mobile: string) => {
  return null;
};

export const fetchAndMergeProfilesByName = async (name: string) => {
  return [];
};

export const upsertRemoteProfile = async (profile: any) => {
  try {
    if (!profile?.mobile) {
      console.error("[CloudSync] upsertRemoteProfile error: mobile is required");
      return null;
    }

    const normalizedMobile = profile.mobile.replace(/\D/g, "");

    const { data, error } = await supabase
      .from(CALLS_TABLE.replace("yaara_calls", "yaara_profiles"))
      .upsert({
        mobile: normalizedMobile,
        name: profile.name || "",
        age: profile.age || null,
        gender: profile.gender || null,
        email: profile.email || null,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("[CloudSync] upsertRemoteProfile error:", error);
      return null;
    }

    console.log("[CloudSync] Profile upserted successfully:", data);
    return data;
  } catch (err) {
    console.error("[CloudSync] upsertRemoteProfile exception:", err);
    return null;
  }
};

export const fetchAllProfiles = async () => {
  return [];
};

export const findMobilesByName = async (name: string): Promise<string[]> => {
  return [];
};

export const upsertRemoteCall = async (call: any) => {
  return null;
};

export const deleteRemoteCall = async (callId: string) => {
  return false;
};

export const fetchRemoteCalls = async (mobile: string) => {
  return [];
};

export const fetchAllCallsFromAllUsers = async () => {
  return [];
};