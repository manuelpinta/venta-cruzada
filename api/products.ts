import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadCatalog } from "./_lib/mysqlCatalog";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const cq = req.query.country;
    const country = String(Array.isArray(cq) ? cq[0] : cq ?? "PC").toUpperCase();
    const sq = req.query.q;
    const searchRaw = String(Array.isArray(sq) ? sq[0] : sq ?? "").trim();

    const result = await loadCatalog(country, searchRaw.length >= 2 ? { search: searchRaw } : undefined);
    if (!result.ok) {
      res.status(result.failure.status).json(result.failure.body);
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(result.rows);
  } catch (e) {
    const details = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : undefined;
    res.status(500).json({
      error: `Error inesperado en /api/products: ${details}`,
      where: "api/products.ts",
      stack,
    });
  }
}

export const config = {
  maxDuration: 60,
};
