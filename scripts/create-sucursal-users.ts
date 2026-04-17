/**
 * Carga sucursales en `public.profiles` (sin Supabase Auth).
 * Si `display_name` ya existe (PC), no inserta de nuevo: solo actualiza la contraseña.
 *
 * Requiere: migración `20260417180000_login_password_by_display_name.sql` (login por display_name).
 * RPC: `set_profile_password(p_employee_number, p_password)` — el primer valor es display_name o nómina.
 * y perfiles sin FK a auth.users (según tu proyecto).
 *
 * `.env.local`: SUPABASE_URL o VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Uso: npm run sucursales:create
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
config({ path: resolve(REPO_ROOT, ".env") });
config({ path: resolve(REPO_ROOT, ".env.local"), override: true });

const LOGIN_PASSWORD = "Pintacomex2k";

const SUCURSALES: string[] = [
  "Coatzacoalcos",
  "Opera",
  "Quevedo",
  "Villa Allende",
  "La Sabana",
  "Petrolera",
  "Colegio Militar (Nueva Petrolera)",
  "Tecnológico",
  "Virreyes",
  "Constituyentes",
  "El Arbol",
  "La Base",
  "Diamante (El Marquez)",
  "Pintamar",
  "Chilpancingo",
  "Huacapa (San Francisco)",
  "Insurgentes",
  "El Hujal",
  "Petatlán",
  "San José",
  "Santa Prisca",
  "Taxco",
  "Mercado",
  "Palmas",
];

function catalogForIndex(i: number): "top25" | "rest" {
  return i % 2 === 0 ? "top25" : "rest";
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim()) {
    console.error("Falta SUPABASE_URL o VITE_SUPABASE_URL en .env.local");
    process.exit(1);
  }
  if (!serviceKey?.trim()) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let index = 0; index < SUCURSALES.length; index++) {
    const sucursal = SUCURSALES[index].trim();
    const catalog = catalogForIndex(index);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("country_code", "PC")
      .eq("display_name", sucursal)
      .maybeSingle();

    if (existing?.id) {
      const { error: pwErr } = await supabase.rpc("set_profile_password", {
        p_employee_number: sucursal,
        p_password: LOGIN_PASSWORD,
      });
      if (pwErr) {
        console.error(`set_profile_password [${sucursal}] (existente):`, pwErr.message);
        continue;
      }
      console.log(`OK  ${sucursal}  (ya existía → contraseña actualizada, catálogo sin cambiar)`);
      continue;
    }

    const id = randomUUID();
    const { error: insErr } = await supabase.from("profiles").insert({
      id,
      country_code: "PC",
      role: "editor",
      employee_number: null,
      display_name: sucursal,
      catalog_segment: catalog,
    });

    if (insErr) {
      console.error(`profiles insert [${sucursal}]:`, insErr.message);
      continue;
    }

    const { error: pwErr } = await supabase.rpc("set_profile_password", {
      p_employee_number: sucursal,
      p_password: LOGIN_PASSWORD,
    });

    if (pwErr) {
      console.error(`set_profile_password [${sucursal}]:`, pwErr.message);
      continue;
    }

    console.log(`OK  ${sucursal}  (nuevo, ${catalog})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
