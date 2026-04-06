import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface AuthUser {
  name: string;
  mobile: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  users: AuthUser[];
  signup: (name: string, mobile: string) => Promise<AuthUser>;
  signin: (name: string, mobile: string) => Promise<AuthUser>;
  signout: () => void;
}

const USERS_KEY = "yaara_users";
const CURRENT_USER_KEY = "yaara_current_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeMobile = (mobile: string) => mobile.replace(/[^0-9]/g, "").trim();
const normalizeName = (name: string) => name.trim();

const loadStoredUsers = (): AuthUser[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as AuthUser[]) : [];
  } catch {
    return [];
  }
};

const loadStoredCurrentUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const saveUsers = (users: AuthUser[]) => {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const saveCurrentUser = (user: AuthUser | null) => {
  if (user) {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(CURRENT_USER_KEY);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<AuthUser[]>(loadStoredUsers);
  const [user, setUser] = useState<AuthUser | null>(loadStoredCurrentUser);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveCurrentUser(user);
  }, [user]);

  const signup = useCallback(async (name: string, mobile: string) => {
    const normalizedMobile = normalizeMobile(mobile);
    const normalizedName = normalizeName(name);

    if (!normalizedName || !normalizedMobile) {
      throw new Error("Naam aur mobile number dono bharna zaroori hai.");
    }

    const existing = users.find(
      (entry) => normalizeMobile(entry.mobile) === normalizedMobile,
    );

    if (existing) {
      if (normalizeName(existing.name).toLowerCase() === normalizedName.toLowerCase()) {
        setUser(existing);
        return existing;
      }
      throw new Error("Yeh mobile number pehle hi kisi aur naam ke saath registered hai.");
    }

    const newUser: AuthUser = {
      name: normalizedName,
      mobile: normalizedMobile,
    };

    setUsers((current) => [...current, newUser]);
    setUser(newUser);
    return newUser;
  }, [users]);

  const signin = useCallback(async (name: string, mobile: string) => {
    const normalizedMobile = normalizeMobile(mobile);
    const normalizedName = normalizeName(name);

    if (!normalizedName || !normalizedMobile) {
      throw new Error("Naam aur mobile number dono bharna zaroori hai.");
    }

    const match = users.find(
      (entry) =>
        normalizeMobile(entry.mobile) === normalizedMobile &&
        normalizeName(entry.name).toLowerCase() === normalizedName.toLowerCase(),
    );

    if (!match) {
      throw new Error("Aisa user nahi mila. Pehle signup karein ya details dobara check karein.");
    }

    setUser(match);
    return match;
  }, [users]);

  const signout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, users, signup, signin, signout }),
    [user, users, signup, signin, signout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
