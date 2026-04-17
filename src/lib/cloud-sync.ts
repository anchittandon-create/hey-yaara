import { supabase } from "@/integrations/supabase/client";
import type { CallRecord } from "@/lib/call-storage";

const CALLS_TABLE = "yaara_calls";

const DEMO_USER_ID = "f51fd26c-dc4e-4a0e-b7d6-75e47639c159";

async function getUserId(): Promise<string> {
  return DEMO_USER_ID;
}

export const fetchUserCalls = async (): Promise<CallRecord[]> => {
  try {
    const userId = await getUserId();
    console.log("[CloudSync] Fetching calls for userId:", userId);
    
    const { data, error } = await supabase
      .from(CALLS_TABLE)
      .select("id,start_time,end_time,duration,status,user_mobile,user_id,updated_at")
      .eq("user_id", userId)
      .order("start_time", { ascending: false });
    
    if (error) {
      console.error("[CloudSync] fetchUserCalls error:", error);
      return [];
    }
    
    console.log("[CloudSync] Calls fetched:", data?.length);
    return data || [];
  } catch (err) {
    console.error("[CloudSync] fetchUserCalls exception:", err);
    return [];
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
  return;
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