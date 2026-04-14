import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CountryCode } from "@/data/countries";
import { normalizeEmployeeNumber, normalizeLoginUsername } from "@/lib/authLogin";
import { supabase } from "@/lib/supabase";

export type UserRole = "editor" | "admin";

export interface UserProfile {
  id: string;
  country_code: CountryCode;
  role: UserRole;
  employee_number: string | null;
}

export interface AppUser {
  id: string;
  username: string;
}

interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileResolved: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (country: CountryCode, role?: UserRole) => Promise<{ error: Error | null }>;
  saveEmployeeNumber: (employeeNumber: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_USERS_TABLE = "profiles";
const SESSION_KEY = "cross-sell:auth-session";

type UserRow = {
  id?: string | number;
  employee_number?: string | null;
  country_code?: CountryCode | null;
  role?: UserRole | null;
};

type StoredSession = {
  id: string;
  username: string;
  country_code: CountryCode;
  role: UserRole;
  employee_number: string;
};

function buildStateFromStored(s: StoredSession): { user: AppUser; profile: UserProfile } {
  return {
    user: { id: s.id, username: s.username },
    profile: {
      id: s.id,
      country_code: s.country_code,
      role: s.role,
      employee_number: s.employee_number,
    },
  };
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredSession>;
    if (!obj.id || !obj.username || !obj.country_code || !obj.role || !obj.employee_number) {
      return null;
    }
    return {
      id: String(obj.id),
      username: String(obj.username),
      country_code: obj.country_code as CountryCode,
      role: (obj.role as UserRole) ?? "editor",
      employee_number: String(obj.employee_number),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);

  useEffect(() => {
    const saved = parseStoredSession(window.localStorage.getItem(SESSION_KEY));
    if (saved) {
      const next = buildStateFromStored(saved);
      setUser(next.user);
      setProfile(next.profile);
    } else {
      setUser(null);
      setProfile(null);
    }
    setProfileResolved(true);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from(AUTH_USERS_TABLE)
      .select("id, employee_number, country_code, role")
      .eq("id", user.id)
      .maybeSingle<UserRow>();

    if (error || !data || !data.country_code) return;

    const id = String(data.id ?? data.employee_number ?? user.id);
    const employeeNumber = String(data.employee_number ?? user.username);
    const nextProfile: UserProfile = {
      id,
      country_code: data.country_code as CountryCode,
      role: (data.role as UserRole) ?? "editor",
      employee_number: employeeNumber,
    };
    const nextUser: AppUser = { id, username: employeeNumber };
    setUser(nextUser);
    setProfile(nextProfile);
    const toStore: StoredSession = {
      id,
      username: employeeNumber,
      country_code: nextProfile.country_code,
      role: nextProfile.role,
      employee_number: employeeNumber,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(toStore));
  }, [user]);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const normalized =
      normalizeEmployeeNumber(username) || normalizeLoginUsername(username);
    if (!normalized) {
      return { error: new Error("Indica tu usuario (número de empleado).") };
    }
    if (!password.trim()) {
      return { error: new Error("Indica tu contraseña.") };
    }

    setLoading(true);
    setProfileResolved(false);
    try {
      const { data, error } = await supabase.rpc("app_login_simple", {
        p_employee_number: normalized,
        p_password: password,
      });

      const row = (Array.isArray(data) ? data[0] : data) as UserRow | null;

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("permission") || msg.includes("rls")) {
          return {
            error: new Error(
              "No hay permiso para validar login. Ejecuta la migración nueva y revisa RLS/policies."
            ),
          };
        }
        return { error: new Error(error.message) };
      }
      if (!row || !row.employee_number) {
        return { error: new Error("Usuario o contraseña inválidos.") };
      }
      if (!row.country_code) {
        return { error: new Error("Usuario sin país asignado.") };
      }

      const id = String(row.id ?? row.employee_number);
      const employeeNumber = String(row.employee_number);
      const nextUser: AppUser = { id, username: employeeNumber };
      const nextProfile: UserProfile = {
        id,
        country_code: row.country_code as CountryCode,
        role: (row.role as UserRole) ?? "editor",
        employee_number: employeeNumber,
      };
      setUser(nextUser);
      setProfile(nextProfile);
      const toStore: StoredSession = {
        id,
        username: employeeNumber,
        country_code: nextProfile.country_code,
        role: nextProfile.role,
        employee_number: employeeNumber,
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(toStore));
      return { error: null };
    } catch (e) {
      const err = e instanceof Error ? e : new Error("No se pudo iniciar sesión");
      return { error: err };
    } finally {
      setProfileResolved(true);
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setProfile(null);
    setProfileResolved(true);
    setLoading(false);
  }, []);

  const saveProfile = useCallback(
    async (country: CountryCode, role: UserRole = "editor") => {
      if (!supabase || !user) return { error: new Error("No hay sesión") };
      const { error } = await supabase
        .from(AUTH_USERS_TABLE)
        .update({ country_code: country, role })
        .eq("id", user.id);
      if (error) return { error: error as Error };
      await refreshProfile();
      return { error: null };
    },
    [user, refreshProfile]
  );

  const saveEmployeeNumber = useCallback(
    async (employeeNumber: string) => {
      if (!supabase || !user) return { error: new Error("No hay sesión") };
      const normalized = normalizeEmployeeNumber(employeeNumber);
      if (!normalized) {
        return { error: new Error("Indica tu número de empleado") };
      }
      const { error } = await supabase
        .from(AUTH_USERS_TABLE)
        .update({ employee_number: normalized })
        .eq("id", user.id);
      if (error) return { error: error as Error };
      await refreshProfile();
      return { error: null };
    },
    [user, refreshProfile]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileResolved,
      signIn,
      signOut,
      refreshProfile,
      saveProfile,
      saveEmployeeNumber,
    }),
    [user, profile, loading, profileResolved, signIn, signOut, refreshProfile, saveProfile, saveEmployeeNumber]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
