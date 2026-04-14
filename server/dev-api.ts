/**
 * API mínima para desarrollo local: sin Vercel ni `vercel link`.
 * Arranca con `npm run dev` (junto a Vite) y sirve GET /api/products.
 *
 * Carga variables desde `.env.local` y `.env` (MYSQL_*, etc.).
 */
import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { loadCatalog } from "./mysqlCatalog";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const port = Number(process.env.CATALOG_DEV_API_PORT ?? 8787);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "GET" || url.pathname !== "/api/products") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const country = url.searchParams.get("country") ?? "PC";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const result = await loadCatalog(country, q.length >= 2 ? { search: q } : undefined);

  if (!result.ok) {
    res.writeHead(result.failure.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(result.failure.body));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(result.rows));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[dev-api] http://127.0.0.1:${port}/api/products (MySQL desde .env.local)`);
});
