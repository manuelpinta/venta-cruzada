/** Usuario de acceso (número de empleado). */
export function normalizeLoginUsername(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s.includes("@")) return "";
  return s;
}

/** Número de empleado / nómina (distinto del usuario de acceso). Solo se normaliza espacio. */
export function normalizeEmployeeNumber(raw: string): string {
  const s = raw.trim();
  if (!s || s.includes("@")) return "";
  return s;
}
