/**
 * call-storage.ts
 *
 * Robust storage for Yaara Call History using IndexedDB.
 * Native localStorage is limited to ~5MB, which isn't enough for 
 * multiple high-quality audio recordings (data URLs).
 */

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
  startTime:  string;
  endTime:    string;
  duration:   number;
  status:     "completed" | "failed" | string;
  transcript: TranscriptLine[];
  audioBlob:  string | null; // data URL
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

  /** Save or update a call */
  async saveCall(call: CallRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(call);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  /** Get all calls, sorted by newest first (descending) */
  async getCalls(): Promise<CallRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => {
        const list = req.result as CallRecord[];
        // Sort descending by startTime (or endTime if missing)
        list.sort((a, b) => {
          const tA = new Date(a.startTime || a.endTime).getTime();
          const tB = new Date(b.startTime || b.endTime).getTime();
          return tB - tA;
        });
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** Delete a call by ID */
  async deleteCall(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
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
