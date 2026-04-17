import { useEffect, useMemo, useState } from "react";

/**
 * Fin de campaña: por defecto 26 de abril 2026, 23:59:59.999 (America/Mexico_City, UTC-6).
 * Tras ese instante la app queda bloqueada (27 abr en adelante).
 * Override: `VITE_FORM_DEADLINE_END_AT` (ISO 8601, ej. `2026-04-26T23:59:59.999-06:00`).
 */
export function getCampaignEndTimestampMs(): number {
  const raw = import.meta.env.VITE_FORM_DEADLINE_END_AT?.trim();
  if (raw) {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return new Date("2026-04-26T23:59:59.999-06:00").getTime();
}

export function useCampaignDeadline(): {
  endMs: number;
  remainingMs: number;
  expired: boolean;
  now: number;
} {
  const endMs = useMemo(() => getCampaignEndTimestampMs(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = endMs - now;
  const expired = now > endMs;
  return { endMs, remainingMs, expired, now };
}
