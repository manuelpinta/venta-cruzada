import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
/** Clave pública: legacy `anon` JWT o clave nueva `sb_publishable_...`. Nunca uses la secret/service_role aquí. */
const publicKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cliente de Supabase para el navegador (clave pública con RLS).
 * Si faltan variables de entorno, queda `null` hasta que configures `.env.local`.
 */
export const supabase: SupabaseClient | null =
  url && publicKey ? createClient(url, publicKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado. En `.env.local` define VITE_SUPABASE_URL y la clave pública (VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY). No uses la secret key en el frontend."
    );
  }
  return supabase;
}
