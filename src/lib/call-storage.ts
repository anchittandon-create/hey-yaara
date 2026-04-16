/**
 * call-storage.ts
 *
 * Robust storage for Yaara Call History using IndexedDB.
 * Native localStorage is limited to ~5MB, which isn't enough for 
 * multiple high-quality audio recordings (data URLs).
 */

import {
  deleteRemoteCall,
  fetchRemoteCalls,
  fetchAllCallsFromAllUsers,
  normalizeMobileKey,
  upsertRemoteCall,
  fetchAllProfiles,
  findMobilesByName
} from "@/lib/cloud-sync";

const DB_NAME    = "yaara_db";
const DB_VERSION = 1;
const STORE_NAME = "calls";

export interface TranscriptLine {
  id:        string;
  role:      "user" | "yaara" | "system";
  text:      string;
  timestamp: string;
  status:    "live" | "final";
}

export interface CallRecord {
  id:         string;
  userMobile?: string;
  startTime:  string;
  endTime:    string;
  duration:   number;
  status:     "completed" | "failed" | string;
  transcript: TranscriptLine[];
  audioBlob:  string | null; // data URL
  updatedAt?: string;
}

class CallStorage {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror   = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  private  async saveLocalOnly(call: CallRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(call);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async findMobilesByName(name: string): Promise<string[]> {
    return findMobilesByName(name);
  }


  /** Save or update a call */
  async saveCall(call: CallRecord): Promise<void> {
    const normalizedCall = {
      ...call,
      userMobile: normalizeMobileKey(call.userMobile),
      updatedAt: call.updatedAt || new Date().toISOString(),
    };
    await this.saveLocalOnly(normalizedCall);

    if (normalizedCall.userMobile) {
      try {
        await upsertRemoteCall(normalizedCall);
      } catch (err) {
        console.warn("[Storage] Remote call sync failed:", err);
      }
    }
  }

  /** Get all calls, sorted by newest first (descending) */
  async getCalls(userMobile?: string, userName?: string, localOnly = false): Promise<CallRecord[]> {
    const db = await this.getDB();
    const normalizedMobile = normalizeMobileKey(userMobile);

    const localCalls = await Promise.race([
      new Promise<CallRecord[]>((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req   = store.getAll();
        req.onsuccess = () => resolve(req.result as CallRecord[]);
        req.onerror = () => reject(req.error);
      }),
      new Promise<CallRecord[]>((_, reject) => setTimeout(() => reject(new Error("Storage Timeout")), 3000))
    ]).catch(err => {
      console.warn("[Storage] Local get failed or timed out:", err);
      return [] as CallRecord[];
    });

    if (localOnly) {
       const merged = new Map<string, CallRecord>();
       
       // ALWAYS fetch all remote calls from all users
       let localCallsToProcess = localCalls;
       
       try {
         const allRemoteCalls = await fetchAllCallsFromAllUsers();
         console.log(`[Storage] Fetched ALL ${allRemoteCalls.length} calls from ALL users`);
         localCallsToProcess = [...localCallsToProcess, ...allRemoteCalls];
       } catch (err) {
         console.warn("[Storage] LocalOnly: fetchAllCallsFromAllUsers failed:", err);
       }
       
       for (const call of localCallsToProcess) {
         merged.set(call.id, call);
       }
       
       return [...merged.values()].sort((a, b) => {
         const tA = a.startTime || a.endTime || "";
         const tB = b.startTime || b.endTime || "";
         return tB.localeCompare(tA);
       });
    }

    let remoteCalls: CallRecord[] = [];
    try {
      // ALWAYS fetch all calls from all users
      remoteCalls = await fetchAllCallsFromAllUsers();
      console.log(`[Storage] Fetched ALL ${remoteCalls.length} calls from ALL users (non-local)`);
    } catch (err) {
      console.warn("[Storage] Remote call fetch failed:", err);
    }

    const merged = new Map<string, CallRecord>();
    const preferNewer = (incoming: CallRecord) => {
      const existing = merged.get(incoming.id);
      if (!existing) {
        merged.set(incoming.id, incoming);
        return;
      }
      const existingTime = new Date(existing.updatedAt || existing.endTime || existing.startTime).getTime();
      const incomingTime = new Date(incoming.updatedAt || incoming.endTime || incoming.startTime).getTime();
      if (incomingTime >= existingTime) merged.set(incoming.id, incoming);
    };

    for (const call of [...localCalls, ...remoteCalls]) {
      preferNewer(call);
    }

    const list = [...merged.values()];

    for (const call of remoteCalls) {
      try {
        await this.saveLocalOnly(call);
      } catch {
        break;
      }
    }

    list.sort((a, b) => {
      const tA = a.startTime || a.endTime || "";
      const tB = b.startTime || b.endTime || "";
      return tB.localeCompare(tA);
    });

    return list;
  }

  /** Delete a call by ID */
  async deleteCall(id: string, userMobile?: string): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });

    const normalizedMobile = normalizeMobileKey(userMobile);
    if (normalizedMobile) {
      try {
        await deleteRemoteCall(id, normalizedMobile);
      } catch (err) {
        console.warn("[Storage] Remote delete failed:", err);
      }
    }
  }

  /** 
   * Heal Sync: Find all local calls that have no mobile number and tag them 
   * with the current user's number so they sync to the cloud.
   */
  async syncAllLocalToCloud(userMobile: string): Promise<void> {
    const normalizedMobile = normalizeMobileKey(userMobile);
    if (!normalizedMobile) return;

    const db = await this.getDB();
    const localCalls = await new Promise<CallRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as CallRecord[]);
      req.onerror = () => reject(req.error);
    });

    for (const call of localCalls) {
      // If call is untagged or tagged with this user, ensure it's in the cloud.
      try {
        if (!call.userMobile || normalizeMobileKey(call.userMobile) === normalizedMobile) {
          const updated = { ...call, userMobile: normalizedMobile };
          await this.saveCall(updated); // This handles both local save and cloud upsert
        }
      } catch (err) {
        console.warn(`[Storage] Failed to sync call ${call.id}:`, err);
        // Continue with the next call
      }
    }
    console.log(`[Storage] Healing sync finished for ${normalizedMobile}`);
  }

  /** 
   * Move legacy calls from localStorage to IndexedDB.
   * Runs only once if localStorage 'yaara_calls' exists.
   */
  async migrateFromLocalStorage(): Promise<void> {
    const raw = localStorage.getItem("yaara_calls");
    if (!raw) return;
    try {
      const calls = JSON.parse(raw) as CallRecord[];
      for (const c of calls) {
        await this.saveCall(c);
      }
      localStorage.removeItem("yaara_calls");
      console.log(`[Storage] Migrated ${calls.length} calls from localStorage to IndexedDB`);
    } catch (err) {
      console.error("[Storage] Migration failed:", err);
    }
  }
}

export const callStorage = new CallStorage();
