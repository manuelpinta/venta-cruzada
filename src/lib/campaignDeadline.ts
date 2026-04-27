import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

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

type DeadlineRpcRow = { end_at?: string | null } | null;

async function fetchCampaignEndTimestampMs(countryCode?: string): Promise<number> {
  const fallback = getCampaignEndTimestampMs();
  if (!countryCode || !isSupabaseConfigured()) return fallback;

  try {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc("app_get_campaign_deadline", {
      p_country_code: countryCode,
    });
    if (error) return fallback;

    const row = (Array.isArray(data) ? data[0] : data) as DeadlineRpcRow;
    const raw = row?.end_at?.trim();
    if (!raw) return fallback;
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) return fallback;
    return ts;
  } catch {
    return fallback;
  }
}

export function useCampaignDeadline(countryCode?: string): {
  endMs: number;
  remainingMs: number;
  expired: boolean;
  now: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const fallbackEndMs = useMemo(() => getCampaignEndTimestampMs(), []);
  const [endMs, setEndMs] = useState(fallbackEndMs);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(() => !!countryCode && isSupabaseConfigured());

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchCampaignEndTimestampMs(countryCode);
    setEndMs(next);
    setLoading(false);
  }, [countryCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = endMs - now;
  const expired = now > endMs;
  return { endMs, remainingMs, expired, now, loading, refresh };
}
