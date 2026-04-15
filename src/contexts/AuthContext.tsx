/**
 * AuthContext.tsx
 *
 * Persistent auth using both localStorage AND IndexedDB for maximum durability.
 * Users stay signed in until explicit signout.
 * Works on desktop, mobile, and tablet.
 */

import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchRemoteProfile,
  normalizeMobileKey,
  upsertRemoteProfile,
} from "@/lib/cloud-sync";

export interface AuthUser {
  name:   string;
  mobile: string;
  age?:    string;
  gender?: string;
  email?:  string;
  yaaraFemaleVoiceId?: string;
  yaarMaleVoiceId?: string;
  updatedAt?: string;
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
const stampUser = (user: AuthUser): AuthUser => ({
  ...user,
  mobile: normMobile(user.mobile),
  updatedAt: user.updatedAt || new Date().toISOString(),
});

const mergeUsers = (localUser: AuthUser | null, remoteUser: AuthUser | null): AuthUser | null => {
  if (!localUser) return remoteUser;
  if (!remoteUser) return localUser;

  const localTime = new Date(localUser.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteUser.updatedAt || 0).getTime();
  return remoteTime >= localTime ? { ...localUser, ...remoteUser } : { ...remoteUser, ...localUser };
};

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
        const localUsers = rawUsers ? (JSON.parse(rawUsers) as AuthUser[]).map(stampUser) : [];
        const localCurrentUser = rawUser ? stampUser(JSON.parse(rawUser) as AuthUser) : null;

        let resolvedUser = localCurrentUser;
        if (localCurrentUser?.mobile) {
          try {
            const remoteUser = await fetchRemoteProfile(localCurrentUser.mobile);
            resolvedUser = mergeUsers(localCurrentUser, remoteUser);
          } catch (err) {
            console.warn("[Auth] Remote profile fetch failed:", err);
          }
        }

        setUsers(localUsers);
        if (resolvedUser) {
          setUser(resolvedUser);
          setUsers((prev) => {
            const filtered = prev.filter((entry) => normalizeMobileKey(entry.mobile) !== normalizeMobileKey(resolvedUser.mobile));
            return [...filtered, resolvedUser];
          });
        }
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
      void upsertRemoteProfile(user).catch((err) => {
        console.warn("[Auth] Remote profile sync failed:", err);
      });
    } else {
      deleteItem(CURRENT_USER_KEY);
    }
  }, [user, loaded]);

  useEffect(() => {
    const handleStorage = async (event: StorageEvent) => {
      if (event.key !== CURRENT_USER_KEY || !event.newValue) return;
      try {
        setUser(stampUser(JSON.parse(event.newValue) as AuthUser));
      } catch {
        // Ignore malformed cross-tab updates.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── signup ────────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (name: string, mobile: string): Promise<AuthUser> => {
      const nm = normMobile(mobile);
      const nn = normName(name);

      if (!nn || !nm) throw new Error("Naam aur mobile number dono bharna zaroori hai.");

      const existing = users.find(u => normMobile(u.mobile) === nm);
      let remoteExisting: AuthUser | null = null;
      try {
        remoteExisting = await fetchRemoteProfile(nm);
      } catch (err) {
        console.warn("[Auth] Signup remote check failed:", err);
      }

      const matchedExisting = existing ?? remoteExisting;
      if (matchedExisting) {
        // Same name → treat as login
        if (normName(matchedExisting.name).toLowerCase() === nn.toLowerCase()) {
          const signedInUser = stampUser(matchedExisting);
          setUser(signedInUser);
          setUsers(prev => {
            const filtered = prev.filter(u => normMobile(u.mobile) !== nm);
            return [...filtered, signedInUser];
          });
          return signedInUser;
        }
        throw new Error("Yeh mobile number pehle hi registered hai.");
      }

      const newUser: AuthUser = stampUser({ name: nn, mobile: nm });
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

      const localMatch = users.find(
        u => normMobile(u.mobile) === nm && normName(u.name).toLowerCase() === nn.toLowerCase(),
      );

      let remoteMatch: AuthUser | null = null;
      if (!localMatch) {
        try {
          const remoteProfile = await fetchRemoteProfile(nm);
          if (remoteProfile && normName(remoteProfile.name).toLowerCase() === nn.toLowerCase()) {
            remoteMatch = stampUser(remoteProfile);
          }
        } catch (err) {
          console.warn("[Auth] Signin remote fetch failed:", err);
        }
      }

      const match = localMatch ? stampUser(localMatch) : remoteMatch;
      if (!match) throw new Error("User nahi mila. Pehle signup karein.");
      setUser(match);
      setUsers(prev => {
        const filtered = prev.filter(u => normMobile(u.mobile) !== nm);
        return [...filtered, match];
      });
      return match;
    },
    [users],
  );

  // ── updateUser ────────────────────────────────────────────────────────────
  const updateUser = useCallback(
    async (updates: Partial<AuthUser>): Promise<AuthUser> => {
      if (!user) throw new Error("Aap signed in nahi hain.");
      
      const updatedUser = stampUser({ ...user, ...updates });
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
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_35%),linear-gradient(180deg,_#0c1222,_#121a31)]">
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-white/5 px-8 py-7 backdrop-blur-xl">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className="text-base font-bold text-amber-50">Loading your Yaara space…</p>
        </div>
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
