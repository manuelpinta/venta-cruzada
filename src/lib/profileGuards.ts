import type { UserProfile } from "@/context/AuthContext";

/** Perfil cargado pero sin número de empleado guardado (el usuario debe completarlo). */
export function needsEmployeeNumber(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return false;
  return !profile.employee_number?.trim();
}
