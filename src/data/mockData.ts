import type { CountryCode } from "./countries";
import type { Product, RecommendationGroup } from "./types";

const C: CountryCode = "PC";

function p(
  id: string,
  sku: string,
  name: string,
  isTop: boolean,
  rank?: number
): Product {
  return { id: sku, sku, countryCode: C, name, isTop, rank };
}

export const products: Product[] = [
  p("p01", "PREP-001", "Masilla Plástica Universal", true, 1),
  p("p02", "PREP-002", "Imprimación Anticorrosiva", true, 5),
  p("p03", "PREP-003", "Sellador Acrílico Blanco", true, 8),
  p("p04", "PREP-004", "Lija al Agua #220", true, 12),
  p("p05", "PREP-005", "Fondo Tapaporos", false),
  p("p06", "PREP-006", "Masilla para Madera", true, 18),
  p("p07", "PREP-007", "Desengrasante Industrial", false),
  p("a01", "ACAB-001", "Pintura Látex Interior Blanca 4L", true, 2),
  p("a02", "ACAB-002", "Esmalte Sintético Brillante", true, 3),
  p("a03", "ACAB-003", "Barniz Marino Transparente", true, 7),
  p("a04", "ACAB-004", "Pintura Exterior Fachada 10L", true, 10),
  p("a05", "ACAB-005", "Laca Satinada para Muebles", true, 14),
  p("a06", "ACAB-006", "Tinte para Madera Nogal", false),
  p("a07", "ACAB-007", "Pintura Anticondensación", false),
  p("a08", "ACAB-008", "Esmalte al Agua Satinado", true, 20),
  p("h01", "HERR-001", "Rodillo Antigoteo 22cm", true, 4),
  p("h02", "HERR-002", "Brocha Profesional 4\"", true, 6),
  p("h03", "HERR-003", "Bandeja para Rodillo", true, 9),
  p("h04", "HERR-004", "Espátula Acero 10cm", true, 11),
  p("h05", "HERR-005", "Cinta de Carrocero 48mm", true, 13),
  p("h06", "HERR-006", "Kit Rodillo + Bandeja Mini", true, 16),
  p("h07", "HERR-007", "Pistola para Silicona", false),
  p("h08", "HERR-008", "Mezclador para Taladro", false),
  p("l01", "PROT-001", "Plástico Protector 4x5m", true, 15),
  p("l02", "PROT-002", "Disolvente Universal 1L", true, 17),
  p("l03", "PROT-003", "Guantes de Nitrilo (caja)", true, 19),
  p("l04", "PROT-004", "Trapo de Limpieza Industrial", false),
  p("l05", "PROT-005", "Mascarilla con Filtro", true, 22),
  p("l06", "PROT-006", "Cinta de Pintor Azul 36mm", false),
];

export const initialRecommendations: RecommendationGroup[] = [
  { baseSku: "ACAB-001", recommendedSkus: ["PREP-001", "HERR-001", "PROT-001"] },
  { baseSku: "ACAB-002", recommendedSkus: ["PREP-002", "HERR-002", "PROT-002"] },
  { baseSku: "ACAB-003", recommendedSkus: ["PREP-004", "HERR-002", "PROT-002"] },
  { baseSku: "PREP-001", recommendedSkus: ["HERR-004", "ACAB-001", "PROT-004"] },
];
