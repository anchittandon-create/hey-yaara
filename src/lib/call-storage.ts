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
  normalizeMobileKey,
  upsertRemoteCall,
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
  async getCalls(userMobile?: string, userName?: string): Promise<CallRecord[]> {
    const db = await this.getDB();
    const normalizedMobile = normalizeMobileKey(userMobile);

    const localCalls = await new Promise<CallRecord[]>((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result as CallRecord[]);
      req.onerror = () => reject(req.error);
    });

    let remoteCalls: CallRecord[] = [];
    if (normalizedMobile) {
      try {
        // Normal fetch for this mobile
        remoteCalls = await fetchRemoteCalls(normalizedMobile);
        
        // NAME-BASED MERGE (Per USER REQUEST): 
        // If user is 'Anchit Tandon', check for other associated numbers to merge
        if (userName?.toLowerCase().includes("anchit")) {
          const associatedMobiles = await this.findMobilesByName(userName);
          for (const altMobile of associatedMobiles) {
            if (normalizeMobileKey(altMobile) === normalizedMobile) continue;
            const altCalls = await fetchRemoteCalls(altMobile);
            remoteCalls = [...remoteCalls, ...altCalls];
          }
        }
      } catch (err) {
        console.warn("[Storage] Remote call fetch failed:", err);
      }
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
      const callMobile = normalizeMobileKey(call.userMobile);
      // Logic: Show if it matches current mobile, OR if current user matches name/context
      if (normalizedMobile && callMobile && callMobile !== normalizedMobile) {
         // Special case: if we are in merge mode, don't skip
         if (!userName?.toLowerCase().includes("anchit")) continue;
      }
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
      const tA = new Date(a.startTime || a.endTime).getTime();
      const tB = new Date(b.startTime || b.endTime).getTime();
      return tB - tA;
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
