/**
 * URL del módulo de soporte / tickets (botón "Contactar a soporte").
 * Preferido: `VITE_SUPPORT_URL`. Compat: `NEXT_PUBLIC_SUPPORT_URL` (mismo valor que en proyectos Next).
 */
export function getSupportUrl(): string | undefined {
  const a = import.meta.env.VITE_SUPPORT_URL?.trim();
  if (a) return a;
  const b = import.meta.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (b) return b;
  return undefined;
}
