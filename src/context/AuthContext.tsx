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

/** Mitad inferior/superior del listado de campaña en `profiles`. */
export type CatalogSegment = "top25" | "rest";

export interface UserProfile {
  id: string;
  country_code: CountryCode;
  role: UserRole;
  /** Nómina / RH (opcional). */
  employee_number: string | null;
  /** Nombre mostrado (ej. sucursal); login con este texto o con employee_number. */
  display_name: string | null;
  catalog_segment: CatalogSegment;
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

const SESSION_KEY = "cross-sell:auth-session";

type UserRow = {
  id?: string | number;
  employee_number?: string | null;
  display_name?: string | null;
  country_code?: CountryCode | null;
  role?: UserRole | null;
  catalog_segment?: string | null;
};

type StoredSession = {
  id: string;
  /** Etiqueta en cabecera: display_name ?? employee_number */
  username: string;
  country_code: CountryCode;
  role: UserRole;
  employee_number: string | null;
  display_name: string | null;
  catalog_segment: CatalogSegment;
};

function normalizeCatalogSegment(raw: unknown): CatalogSegment {
  if (raw === "rest") return "rest";
  return "top25";
}

function buildStateFromStored(s: StoredSession): { user: AppUser; profile: UserProfile } {
  return {
    user: { id: s.id, username: s.username },
    profile: {
      id: s.id,
      country_code: s.country_code,
      role: s.role,
      employee_number: s.employee_number,
      display_name: s.display_name ?? null,
      catalog_segment: s.catalog_segment,
    },
  };
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredSession> & { employee_number?: unknown };
    if (!obj.id || !obj.country_code || !obj.role) {
      return null;
    }
    const seg = normalizeCatalogSegment((obj as Partial<StoredSession>).catalog_segment);
    const emp =
      obj.employee_number != null && String(obj.employee_number).trim() !== ""
        ? String(obj.employee_number)
        : null;
    const disp =
      obj.display_name != null && String(obj.display_name).trim() !== ""
        ? String(obj.display_name)
        : null;
    const username = String(obj.username ?? disp ?? emp ?? "");
    if (!username) return null;
    return {
      id: String(obj.id),
      username,
      country_code: obj.country_code as CountryCode,
      role: (obj.role as UserRole) ?? "editor",
      employee_number: emp,
      display_name: disp,
      catalog_segment: seg,
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
    const { data: raw, error } = await supabase.rpc("app_get_profile", { p_id: user.id });
    const data = (Array.isArray(raw) ? raw[0] : raw) as UserRow | null | undefined;

    if (error || !data || !data.country_code) return;

    const id = String(data.id ?? user.id);
    const emp = data.employee_number != null && String(data.employee_number).trim() !== "" ? String(data.employee_number) : null;
    const disp = data.display_name != null && String(data.display_name).trim() !== "" ? String(data.display_name) : null;
    const label = disp ?? emp ?? user.username;
    const seg = normalizeCatalogSegment(data.catalog_segment);
    const nextProfile: UserProfile = {
      id,
      country_code: data.country_code as CountryCode,
      role: (data.role as UserRole) ?? "editor",
      employee_number: emp,
      display_name: disp,
      catalog_segment: seg,
    };
    const nextUser: AppUser = { id, username: label };
    setUser(nextUser);
    setProfile(nextProfile);
    const toStore: StoredSession = {
      id,
      username: label,
      country_code: nextProfile.country_code,
      role: nextProfile.role,
      employee_number: emp,
      display_name: disp,
      catalog_segment: seg,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(toStore));
  }, [user]);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase no configurado") };
    const normalized =
      normalizeEmployeeNumber(username) || normalizeLoginUsername(username);
    if (!normalized) {
      return { error: new Error("Indica tu usuario (nombre de sucursal o nómina).") };
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
      const emp = row.employee_number != null && String(row.employee_number).trim() !== "" ? String(row.employee_number) : null;
      const disp = row.display_name != null && String(row.display_name).trim() !== "" ? String(row.display_name) : null;
      if (!row || (!emp && !disp)) {
        return {
          error: new Error(
            "Contraseña incorrecta. Revisa el usuario (sucursal o nómina) y la clave; comprueba mayúsculas y espacios."
          ),
        };
      }
      if (!row.country_code) {
        return { error: new Error("Usuario sin país asignado.") };
      }

      const id = String(row.id ?? emp ?? disp);
      const label = disp ?? emp ?? "";
      const nextUser: AppUser = { id, username: label };
      const seg = normalizeCatalogSegment(row.catalog_segment);
      const nextProfile: UserProfile = {
        id,
        country_code: row.country_code as CountryCode,
        role: (row.role as UserRole) ?? "editor",
        employee_number: emp,
        display_name: disp,
        catalog_segment: seg,
      };
      setUser(nextUser);
      setProfile(nextProfile);
      const toStore: StoredSession = {
        id,
        username: label,
        country_code: nextProfile.country_code,
        role: nextProfile.role,
        employee_number: emp,
        display_name: disp,
        catalog_segment: seg,
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
      const { error } = await supabase.rpc("app_update_profile_country_role", {
        p_id: user.id,
        p_country_code: country,
        p_role: role,
      });
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
      const { error } = await supabase.rpc("app_update_profile_employee", {
        p_id: user.id,
        p_employee_number: normalized,
      });
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
