import type { CountryCode } from "./countries";

export type { CountryCode };

export interface Product {
  /** Estable para rutas y APIs: coincide con `sku` del catálogo. */
  id: string;
  sku: string;
  countryCode: CountryCode;
  name: string;
  isTop: boolean;
  rank?: number;
  productLine?: string;
  brand?: string;
  pahl?: string;
}

/** Agrupación en memoria: recomendaciones por SKU base. */
export interface RecommendationGroup {
  baseSku: string;
  recommendedSkus: string[];
}
