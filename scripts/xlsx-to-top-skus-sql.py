#!/usr/bin/env python3
"""
Lee un Excel tipo "Top 50 Pinta.xlsx" (columna A = CveAsoc, B = Descrip, fila 1 = encabezado)
y escribe SQL INSERT para public.top_product_skus (con display_name).

Uso:
  python scripts/xlsx-to-top-skus-sql.py "ruta/al/archivo.xlsx" PC > supabase/mi_seed.sql

country_code: PC (Pintacomex), GC (Gallco), HN, BZ, SV

Requiere Python 3 (sin dependencias; parsea el .xlsx como ZIP/XML).
"""

from __future__ import annotations

import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def col_to_idx(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c.upper()) - 64)
    return n - 1


def load_shared_strings(z: zipfile.ZipFile) -> list[str]:
    data = z.read("xl/sharedStrings.xml")
    root = ET.fromstring(data)
    strings: list[str] = []
    for si in root.findall(".//m:si", NS):
        t = si.find("m:t", NS)
        if t is not None and t.text:
            strings.append(t.text)
            continue
        parts: list[str] = []
        for r in si.findall("m:r", NS):
            tt = r.find("m:t", NS)
            if tt is not None and tt.text:
                parts.append(tt.text)
        strings.append("".join(parts) if parts else "")
    return strings


def iter_sku_name_rows(path: Path) -> list[tuple[str, str]]:
    with zipfile.ZipFile(path) as z:
        strings = load_shared_strings(z)
        sheet = z.read("xl/worksheets/sheet1.xml")
    root = ET.fromstring(sheet)
    rows: dict[int, dict[int, str]] = {}
    for row in root.findall(".//m:sheetData/m:row", NS):
        rnum = int(row.get("r", "0"))
        rows[rnum] = {}
        for c in row.findall("m:c", NS):
            ref = c.get("r", "")
            col = "".join(x for x in ref if x.isalpha())
            v = c.find("m:v", NS)
            if v is None or v.text is None:
                continue
            val = v.text
            if c.get("t") == "s":
                val = strings[int(val)]
            rows[rnum][col_to_idx(col)] = val.strip()

    out: list[tuple[str, str]] = []
    for r in sorted(rows.keys()):
        if r == 1:
            continue
        row = rows[r]
        sku = row.get(0, "").strip()
        if not sku:
            continue
        name = row.get(1, "").strip()
        out.append((sku, name))
    return out


def main() -> None:
    if len(sys.argv) < 3:
        print("Uso: python xlsx-to-top-skus-sql.py <archivo.xlsx> <PC|GC|HN|BZ|SV>", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    country = sys.argv[2].upper()
    if country not in ("PC", "GC", "HN", "BZ", "SV"):
        print("country_code debe ser PC, GC, HN, BZ o SV", file=sys.stderr)
        sys.exit(1)
    pairs = iter_sku_name_rows(path)
    if not pairs:
        print("No se leyeron SKUs en la columna A.", file=sys.stderr)
        sys.exit(1)
    if len(pairs) > 50:
        print(f"Aviso: hay {len(pairs)} filas; la tabla solo permite rank 1..50. Recortando.", file=sys.stderr)
        pairs = pairs[:50]

    def esc(s: str) -> str:
        return s.replace("'", "''")

    print(f"-- Generado desde {path.name}")
    print(f"DELETE FROM public.top_product_skus WHERE country_code = '{country}';")
    print()
    print("INSERT INTO public.top_product_skus (country_code, sku, rank, display_name) VALUES")
    lines = []
    for i, (sku, name) in enumerate(pairs, start=1):
        lines.append(f"  ('{country}', '{esc(sku)}', {i}, '{esc(name)}')")
    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
