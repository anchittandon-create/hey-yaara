/**
 * AuthContext.tsx
 *
 * Persistent auth using both localStorage AND IndexedDB for maximum durability.
 * Users stay signed in until explicit signout.
 * Works on desktop, mobile, and tablet.
 */

import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface AuthUser {
  name:   string;
  mobile: string;
  age?:    string;
  gender?: string;
  email?:  string;
  yaaraFemaleVoiceId?: string;
  yaarMaleVoiceId?: string;
}

interface AuthContextValue {
  user:    AuthUser | null;
  users:   AuthUser[];
  signup:  (name: string, mobile: string) => Promise<AuthUser>;
  signin:  (name: string, mobile: string) => Promise<AuthUser>;
  updateUser: (updates: Partial<AuthUser>) => Promise<AuthUser>;
  signout: () => void;
}

const USERS_KEY        = "yaara_users";
const CURRENT_USER_KEY = "yaara_current_user";
const DB_NAME          = "yaara_auth";
const DB_VERSION       = 1;
const STORE            = "kv";

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = ()  => reject(req.error);
  });

const dbGet = async (key: string): Promise<string | null> => {
  try {
    const db  = await openDB();
    const tx  = db.transaction(STORE, "readonly");
    const val = await new Promise<string | null>((resolve, reject) => {
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = ()  => reject(req.error);
    });
    db.close();
    return val;
  } catch {
    return null;
  }
};

const dbSet = async (key: string, value: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = ()  => reject(req.error);
    });
    db.close();
  } catch { /* silently ignore – localStorage is the fallback */ }
};

const dbDel = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    db.close();
  } catch { /* ignore */ }
};

// ─── localStorage helpers (primary / fallback) ────────────────────────────────

const lsGet = (key: string): string | null => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};

const lsSet = (key: string, value: string): void => {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
};

const lsDel = (key: string): void => {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
};

// ─── Combined read/write (writes both stores) ─────────────────────────────────

const readItem = async (key: string): Promise<string | null> => {
  // Try localStorage first (sync, fast)
  const ls = lsGet(key);
  if (ls) return ls;
  // Fallback: IndexedDB
  return dbGet(key);
};

const writeItem = async (key: string, value: string): Promise<void> => {
  lsSet(key, value);
  await dbSet(key, value);
};

const deleteItem = async (key: string): Promise<void> => {
  lsDel(key);
  await dbDel(key);
};

// ─── Normalise ────────────────────────────────────────────────────────────────

const normMobile = (m: string) => m.replace(/\D/g, "").trim();
const normName   = (n: string) => n.trim();

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [user,  setUser]  = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const rawUsers = await readItem(USERS_KEY);
        const rawUser  = await readItem(CURRENT_USER_KEY);
        if (rawUsers)  setUsers(JSON.parse(rawUsers) as AuthUser[]);
        if (rawUser)   setUser(JSON.parse(rawUser)   as AuthUser);
      } catch { /* start fresh */ }
      setLoaded(true);
    })();
  }, []);

  // Persist users whenever they change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    writeItem(USERS_KEY, JSON.stringify(users));
  }, [users, loaded]);

  // Persist current user whenever it changes
  useEffect(() => {
    if (!loaded) return;
    if (user) {
      writeItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      deleteItem(CURRENT_USER_KEY);
    }
  }, [user, loaded]);

  // ── signup ────────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (name: string, mobile: string): Promise<AuthUser> => {
      const nm = normMobile(mobile);
      const nn = normName(name);

      if (!nn || !nm) throw new Error("Naam aur mobile number dono bharna zaroori hai.");

      const existing = users.find(u => normMobile(u.mobile) === nm);

      if (existing) {
        // Same name → treat as login
        if (normName(existing.name).toLowerCase() === nn.toLowerCase()) {
          setUser(existing);
          return existing;
        }
        throw new Error("Yeh mobile number pehle hi registered hai.");
      }

      const newUser: AuthUser = { name: nn, mobile: nm };
      setUsers(prev => [...prev, newUser]);
      setUser(newUser);
      return newUser;
    },
    [users],
  );

  // ── signin ────────────────────────────────────────────────────────────────
  const signin = useCallback(
    async (name: string, mobile: string): Promise<AuthUser> => {
      const nm = normMobile(mobile);
      const nn = normName(name);

      if (!nn || !nm) throw new Error("Naam aur mobile number dono bharna zaroori hai.");

      const match = users.find(
        u => normMobile(u.mobile) === nm && normName(u.name).toLowerCase() === nn.toLowerCase(),
      );

      if (!match) throw new Error("User nahi mila. Pehle signup karein.");
      setUser(match);
      return match;
    },
    [users],
  );

  // ── updateUser ────────────────────────────────────────────────────────────
  const updateUser = useCallback(
    async (updates: Partial<AuthUser>): Promise<AuthUser> => {
      if (!user) throw new Error("Aap signed in nahi hain.");
      
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      // Update in the users list too
      setUsers(prev => prev.map(u => 
        normMobile(u.mobile) === normMobile(user.mobile) ? updatedUser : u
      ));
      
      return updatedUser;
    },
    [user],
  );

  // ── signout ───────────────────────────────────────────────────────────────
  const signout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, users, signup, signin, updateUser, signout }),
    [user, users, signup, signin, updateUser, signout],
  );

  // Don't render children until storage has been read (prevents flash)
  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
