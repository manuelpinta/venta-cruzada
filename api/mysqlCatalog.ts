import mysql, { type RowDataPacket } from "mysql2/promise";

const COUNTRIES = new Set(["PC", "GC", "HN", "BZ", "SV"]);

export type CatalogRow = {
  CveAsoc: string;
  DescripLar: string;
  country_code: string;
};

export type CatalogFailure = { status: number; body: { error: string } };

function sqlIdent(raw: string, fallback: string): string {
  const s = raw.trim() || fallback;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) ? s : fallback;
}

function escapeLikePattern(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function databaseForCountry(country: string): string | undefined {
  const map: Record<string, string | undefined> = {
    PC: process.env.MYSQL_DB_PC ?? process.env.MYSQL_DB_MX ?? process.env.MYSQL_DB_PINTACOMEX,
    GC: process.env.MYSQL_DB_GC ?? process.env.MYSQL_DB_GALLCO,
    HN: process.env.MYSQL_DB_HN,
    BZ: process.env.MYSQL_DB_BZ,
    SV: process.env.MYSQL_DB_SV,
  };
  const v = map[country]?.trim();
  return v || undefined;
}

export type LoadCatalogOptions = {
  search?: string;
};

export async function loadCatalog(
  countryRaw: string,
  opts?: LoadCatalogOptions
): Promise<{ ok: true; rows: CatalogRow[] } | { ok: false; failure: CatalogFailure }> {
  const country = String(countryRaw ?? "PC").toUpperCase();
  if (!COUNTRIES.has(country)) {
    return { ok: false, failure: { status: 400, body: { error: "Invalid country" } } };
  }

  const host = process.env.MYSQL_HOST?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD ?? "";
  const port = Number(process.env.MYSQL_PORT ?? "3306");

  if (!host || !user) {
    return {
      ok: false,
      failure: {
        status: 503,
        body: { error: "MySQL no configurado en el servidor (MYSQL_HOST, MYSQL_USER)" },
      },
    };
  }

  const database = databaseForCountry(country);
  if (!database) {
    return {
      ok: false,
      failure: {
        status: 503,
        body: { error: `Base de datos MySQL no configurada para ${country} (MYSQL_DB_${country})` },
      },
    };
  }

  const table = sqlIdent(process.env.PRODUCTOS_TABLE ?? "", "producto");
  const idCol = sqlIdent(process.env.PRODUCTOS_ID_COL ?? "", "CveAsoc");
  const nameCol = sqlIdent(process.env.PRODUCTOS_NOMBRE_COL ?? "", "DescripLar");
  const activoCol = sqlIdent(process.env.PRODUCTOS_ACTIVO_COL ?? "", "IdCanRefLista");
  const limit = Math.min(Math.max(Number(process.env.CATALOG_QUERY_LIMIT ?? "8000") || 8000, 1), 20000);
  const searchLimit = Math.min(Math.max(Number(process.env.CATALOG_SEARCH_LIMIT ?? "150") || 150, 1), 500);

  const searchTerm = opts?.search?.trim() ?? "";
  const useSearch = searchTerm.length >= 2;

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 15000,
    });

    const filtroActivo = `\`${activoCol}\` = 0`;

    let list: RowDataPacket[];
    if (useSearch) {
      const pat = `%${escapeLikePattern(searchTerm)}%`;
      const sql = `SELECT \`${idCol}\` AS CveAsoc, \`${nameCol}\` AS DescripLar FROM \`${table}\`
        WHERE ${filtroActivo}
          AND (CAST(\`${idCol}\` AS CHAR) LIKE ? OR \`${nameCol}\` LIKE ?)
        LIMIT ${searchLimit}`;
      const [rows] = await conn.query(sql, [pat, pat]);
      list = rows as RowDataPacket[];
    } else {
      const sql = `SELECT \`${idCol}\` AS CveAsoc, \`${nameCol}\` AS DescripLar FROM \`${table}\`
        WHERE ${filtroActivo}
        ORDER BY CAST(\`${idCol}\` AS CHAR) ASC
        LIMIT ${limit}`;
      const [rows] = await conn.query(sql);
      list = rows as RowDataPacket[];
    }

    const body: CatalogRow[] = list.map((row) => ({
      CveAsoc: row.CveAsoc != null ? String(row.CveAsoc) : "",
      DescripLar: row.DescripLar != null ? String(row.DescripLar) : "",
      country_code: country,
    }));

    return { ok: true, rows: body };
  } catch (e) {
    console.error("[api/mysqlCatalog]", e);
    const details = e instanceof Error && e.message ? `: ${e.message}` : "";
    return {
      ok: false,
      failure: {
        status: 500,
        body: { error: `Error al leer el catálogo MySQL${details}` },
      },
    };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
