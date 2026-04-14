#!/usr/bin/env python3
"""
Genera los 5 archivos SQL en supabase/ desde los Excel en Descargas:
  Top 50 Pinta.xlsx → PC
  Top 50 Gallco.xlsx → GC
  Top 50 Belice.xlsx → BZ
  Top 50 Honduras.xlsx → HN
  Top 50 El Salvador.xlsx → SV

Uso: python scripts/generate_all_top50_seeds.py

Ajusta DOWNLOADS si tu carpeta no es la de usuario por defecto.
"""

from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

# Mismo parser que scripts/xlsx-to-top-skus-sql.py
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

JOBS: list[tuple[str, str, str]] = [
    ("Top 50 Pinta.xlsx", "PC", "seed_top50_pintacomex_pc.sql"),
    ("Top 50 Gallco.xlsx", "GC", "seed_top50_gallco_gc.sql"),
    ("Top 50 Belice.xlsx", "BZ", "seed_top50_belice_bz.sql"),
    ("Top 50 Honduras.xlsx", "HN", "seed_top50_honduras_hn.sql"),
    ("Top 50 El Salvador.xlsx", "SV", "seed_top50_el_salvador_sv.sql"),
]


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
    return out[:50]


def esc(s: str) -> str:
    return s.replace("'", "''")


def build_sql(source_name: str, country: str, pairs: list[tuple[str, str]]) -> str:
    lines = [
        f"-- Generado desde {source_name} (columna A=CveAsoc, B=Descrip).",
        "-- Ejecutar en Supabase SQL Editor tras la migración 20260404140000_pc_gc_display_name.sql",
        "",
        f"DELETE FROM public.top_product_skus WHERE country_code = '{country}';",
        "",
        "INSERT INTO public.top_product_skus (country_code, sku, rank, display_name) VALUES",
    ]
    for i, (sku, name) in enumerate(pairs, start=1):
        comma = "," if i < len(pairs) else ";"
        lines.append(f"  ('{country}', '{esc(sku)}', {i}, '{esc(name)}'){comma}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    downloads = Path.home() / "Downloads"
    out_dir = Path(__file__).resolve().parents[1] / "supabase"

    for filename, country, out_name in JOBS:
        xlsx = downloads / filename
        if not xlsx.is_file():
            print(f"OMITIDO (no existe): {xlsx}", flush=True)
            continue
        pairs = iter_sku_name_rows(xlsx)
        if not pairs:
            print(f"VACÍO: {filename}", flush=True)
            continue
        text = build_sql(filename, country, pairs)
        out_path = out_dir / out_name
        out_path.write_text(text, encoding="utf-8")
        print(f"OK {len(pairs)} filas -> {out_path.name}", flush=True)


if __name__ == "__main__":
    main()
