/**
 * Crea un perfil `role = admin` para ver el resumen en /admin/resumen (mismo país que indiques).
 *
 * Requiere: SUPABASE_URL o VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY en `.env.local`.
 * Uso:
 *   npx tsx scripts/create-admin-monitor.ts
 *   ADMIN_DISPLAY_NAME="Supervisor" ADMIN_COUNTRY=PC ADMIN_PASSWORD="TuClave" npx tsx scripts/create-admin-monitor.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
config({ path: resolve(REPO_ROOT, ".env") });
config({ path: resolve(REPO_ROOT, ".env.local"), override: true });

const DISPLAY = (process.env.ADMIN_DISPLAY_NAME ?? "Admin Monitoreo").trim();
const COUNTRY = (process.env.ADMIN_COUNTRY ?? "PC").trim().toUpperCase();
const PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim()) {
    console.error("Falta SUPABASE_URL o VITE_SUPABASE_URL");
    process.exit(1);
  }
  if (!serviceKey?.trim()) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!PASSWORD || PASSWORD.length < 4) {
    console.error("Define ADMIN_PASSWORD en el entorno (mín. 4 caracteres).");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("country_code", COUNTRY)
    .eq("display_name", DISPLAY)
    .maybeSingle();

  if (existing?.id) {
    const { error: pwErr } = await supabase.rpc("set_profile_password", {
      p_employee_number: DISPLAY,
      p_password: PASSWORD,
    });
    if (pwErr) {
      console.error("set_profile_password:", pwErr.message);
      process.exit(1);
    }
    console.log(`Perfil ya existía (${DISPLAY} · ${COUNTRY}) → contraseña actualizada.`);
    return;
  }

  const id = randomUUID();
  const { error: insErr } = await supabase.from("profiles").insert({
    id,
    country_code: COUNTRY,
    role: "admin",
    employee_number: null,
    display_name: DISPLAY,
    catalog_segment: "top25",
  });

  if (insErr) {
    console.error("profiles insert:", insErr.message);
    process.exit(1);
  }

  const { error: pwErr } = await supabase.rpc("set_profile_password", {
    p_employee_number: DISPLAY,
    p_password: PASSWORD,
  });

  if (pwErr) {
    console.error("set_profile_password:", pwErr.message);
    process.exit(1);
  }

  console.log(`OK  admin creado: display_name="${DISPLAY}" country=${COUNTRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
