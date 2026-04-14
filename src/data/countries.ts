/** PC = Pintacomex, GC = Gallco (México en dos líneas); resto = países. */
export type CountryCode = "PC" | "GC" | "HN" | "BZ" | "SV";

export const COUNTRY_CODES: CountryCode[] = ["PC", "GC", "HN", "BZ", "SV"];

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  PC: "Pintacomex",
  GC: "Gallco",
  HN: "Honduras",
  BZ: "Belice",
  SV: "El Salvador",
};

const STORAGE_KEY = "cross-sell-country";

export function getStoredCountry(): CountryCode {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && COUNTRY_CODES.includes(v as CountryCode)) return v as CountryCode;
  return "PC";
}

export function setStoredCountry(c: CountryCode): void {
  localStorage.setItem(STORAGE_KEY, c);
}
