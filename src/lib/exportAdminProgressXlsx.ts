import * as XLSX from "xlsx";

export type AdminProgressExportRow = {
  sucursal: string;
  grupo: "A" | "B";
  porcentaje: number;
  completos: number;
  parciales: number;
  pendientes: number;
  bases: number;
};

/**
 * Descarga un .xlsx con el resumen (mismas columnas que la tabla en pantalla).
 */
export function downloadAdminProgressXlsx(
  rows: AdminProgressExportRow[],
  meta: { countryCode: string }
): void {
  if (rows.length === 0) return;

  const sheetRows = rows.map((r) => ({
    Sucursal: r.sucursal,
    Grupo: r.grupo,
    "%": r.porcentaje,
    Completos: r.completos,
    Parciales: r.parciales,
    Pendientes: r.pendientes,
    Bases: r.bases,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resumen");

  const date = new Date().toISOString().slice(0, 10);
  const safeCountry = meta.countryCode.replace(/[^\w-]/g, "");
  const filename = `resumen-sucursales-${safeCountry || "mercado"}-${date}.xlsx`;

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
