import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  Download,
  Search,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupportLinkButton } from "@/components/SupportLinkButton";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { COUNTRY_LABELS } from "@/data/countries";
import { useCampaignDeadline } from "@/lib/campaignDeadline";
import { cn } from "@/lib/utils";

type ProgressRow = {
  user_id: string;
  display_name: string | null;
  employee_number: string | null;
  catalog_segment: string | null;
  bases_total: number;
  bases_complete: number;
  bases_partial: number;
  bases_pending: number;
  pct_complete: number;
};

type SortKey = "sucursal" | "grupo" | "pct" | "complete" | "partial" | "pending" | "bases";
type SortDir = "asc" | "desc";

function rowLabel(r: ProgressRow): string {
  return r.display_name?.trim() || r.employee_number?.trim() || r.user_id.slice(0, 8);
}

/** `catalog_segment` en BD: top25 = grupo A (1–25), rest = grupo B (26–50). */
function grupoLetter(r: ProgressRow): "A" | "B" {
  return r.catalog_segment === "rest" ? "B" : "A";
}

const GRUPO_TITLE: Record<"A" | "B", string> = {
  A: "Grupo A · puestos 1–25 del Top 50",
  B: "Grupo B · puestos 26–50 del Top 50",
};

function toLocalDateTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function AdminSucursalProgress() {
  const { user, profile, signOut } = useAuth();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sucursal");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [deadlineBusy, setDeadlineBusy] = useState(false);
  const [deadlineMsg, setDeadlineMsg] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const {
    endMs: campaignEndMs,
    loading: deadlineLoading,
    refresh: refreshDeadline,
  } = useCampaignDeadline(profile?.country_code);

  useEffect(() => {
    if (!campaignEndMs) return;
    setDeadlineInput(toLocalDateTimeInputValue(campaignEndMs));
  }, [campaignEndMs]);

  useEffect(() => {
    if (!user || !isAdmin || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const sb = requireSupabase();
    void sb.rpc("app_admin_sucursal_progress", { p_admin_id: user.id }).then(({ data, error: rpcErr }) => {
      if (cancelled) return;
      setLoading(false);
      if (rpcErr) {
        setError(rpcErr.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as ProgressRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  const filteredSorted = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    let list = q
      ? rows.filter((r) => rowLabel(r).toLowerCase().includes(q))
      : [...rows];

    const mult = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const cmpNum = (x: number, y: number) => (x < y ? -mult : x > y ? mult : 0);
      const cmpStr = (x: string, y: string) => (x < y ? -mult : x > y ? mult : 0);
      switch (sortKey) {
        case "sucursal":
          return cmpStr(rowLabel(a).toLowerCase(), rowLabel(b).toLowerCase());
        case "grupo":
          return cmpStr(grupoLetter(a), grupoLetter(b));
        case "pct":
          return cmpNum(a.pct_complete, b.pct_complete);
        case "complete":
          return cmpNum(a.bases_complete, b.bases_complete);
        case "partial":
          return cmpNum(a.bases_partial, b.bases_partial);
        case "pending":
          return cmpNum(a.bases_pending, b.bases_pending);
        case "bases":
          return cmpNum(a.bases_total, b.bases_total);
        default:
          return 0;
      }
    });
    return list;
  }, [rows, filterQuery, sortKey, sortDir]);

  /** Métricas de todo el mercado (no dependen del filtro de la tabla). */
  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const sucursales = rows.length;
    const grupoA = rows.filter((r) => grupoLetter(r) === "A").length;
    const grupoB = rows.filter((r) => grupoLetter(r) === "B").length;
    const basesTotal = rows.reduce((s, r) => s + r.bases_total, 0);
    const basesComplete = rows.reduce((s, r) => s + r.bases_complete, 0);
    const basesPending = rows.reduce((s, r) => s + r.bases_pending, 0);
    const pctGlobal = basesTotal > 0 ? Math.round((basesComplete / basesTotal) * 100) : 0;

    const sucursalesSinIniciar = rows.filter((r) => r.pct_complete === 0).length;
    const sucursalesCompletas = rows.filter((r) => r.pct_complete >= 100).length;
    const sucursalesEnProgreso = rows.filter((r) => r.pct_complete > 0 && r.pct_complete < 100).length;

    return {
      sucursales,
      grupoA,
      grupoB,
      basesTotal,
      basesComplete,
      basesPending,
      pctGlobal,
      sucursalesSinIniciar,
      sucursalesCompletas,
      sucursalesEnProgreso,
    };
  }, [rows]);

  const handleExportExcel = useCallback(async () => {
    if (filteredSorted.length === 0 || !profile) return;
    const { downloadAdminProgressXlsx } = await import("@/lib/exportAdminProgressXlsx");
    downloadAdminProgressXlsx(
      filteredSorted.map((r) => ({
        sucursal: rowLabel(r),
        grupo: grupoLetter(r),
        porcentaje: r.pct_complete,
        completos: r.bases_complete,
        parciales: r.bases_partial,
        pendientes: r.bases_pending,
        bases: r.bases_total,
      })),
      { countryCode: profile.country_code }
    );
  }, [filteredSorted, profile]);

  const saveDeadline = useCallback(
    async (dateTimeLocal: string) => {
      if (!user || !profile) return;
      const parsed = Date.parse(dateTimeLocal);
      if (!Number.isFinite(parsed)) {
        setDeadlineMsg("Fecha/hora inválida.");
        return;
      }
      setDeadlineBusy(true);
      setDeadlineMsg(null);
      const sb = requireSupabase();
      const { error: rpcErr } = await sb.rpc("app_admin_set_campaign_deadline", {
        p_admin_id: user.id,
        p_end_at: new Date(parsed).toISOString(),
      });
      if (rpcErr) {
        setDeadlineMsg(rpcErr.message);
        setDeadlineBusy(false);
        return;
      }
      await refreshDeadline();
      setDeadlineInput(toLocalDateTimeInputValue(parsed));
      setDeadlineMsg("Fecha de cierre actualizada.");
      setDeadlineBusy(false);
    },
    [user, profile, refreshDeadline]
  );

  const handleSaveDeadline = useCallback(async () => {
    await saveDeadline(deadlineInput);
  }, [saveDeadline, deadlineInput]);

  const handleAddOneDay = useCallback(async () => {
    const next = toLocalDateTimeInputValue(campaignEndMs + 24 * 60 * 60 * 1000);
    await saveDeadline(next);
  }, [campaignEndMs, saveDeadline]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "sucursal" || key === "grupo" ? "asc" : "desc");
    }
  }

  function SortGlyph({ column }: { column: SortKey }) {
    if (sortKey !== column) {
      return <span className="inline-flex flex-col leading-none opacity-40" aria-hidden>
        <ArrowUp className="h-2.5 w-2.5 -mb-0.5" />
        <ArrowDown className="h-2.5 w-2.5" />
      </span>;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-sm text-slate-600">Supabase no está configurado.</p>
      </div>
    );
  }

  if (!profile || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const label =
    profile.display_name?.trim() || profile.employee_number?.trim() || user?.username?.trim() || "Cuenta";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
          <h1 className="text-base font-bold text-slate-900 truncate">Resumen por sucursal</h1>
          <div className="flex items-center gap-2 shrink-0">
            <SupportLinkButton />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void signOut()}>
              <span className="truncate max-w-[9rem]">{label}</span> · Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 lg:px-8 py-6 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Control de campaña</p>
              <p className="text-sm text-slate-700">
                Cierre actual:{" "}
                <strong>
                  {new Date(campaignEndMs).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-slate-200 bg-white"
                onClick={() => void handleAddOneDay()}
                disabled={deadlineBusy || deadlineLoading}
              >
                +1 día
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative max-w-sm w-full">
              <CalendarClock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="datetime-local"
                step={60}
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className="pl-9 bg-white border-slate-200"
                aria-label="Fecha de cierre de campaña"
                disabled={deadlineBusy || deadlineLoading}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => void handleSaveDeadline()}
              disabled={deadlineBusy || deadlineLoading || !deadlineInput}
            >
              {deadlineBusy ? "Guardando..." : "Guardar fecha"}
            </Button>
          </div>
          {deadlineMsg && <p className="text-xs text-slate-600">{deadlineMsg}</p>}
        </section>

        {!loading && summary && (
          <div className="space-y-4">
            {/* 1. Principal: ¿dónde está el problema? — conteo por sucursal */}
            <section
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
              aria-labelledby="admin-estado-sucursales"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Estado por sucursal</p>
                <h2 id="admin-estado-sucursales" className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {COUNTRY_LABELS[profile.country_code]}
                </h2>
                <p className="text-sm text-slate-600">
                  Total <strong>{summary.sucursales}</strong> sucursales · Grupo catálogo{" "}
                  <strong>
                    A {summary.grupoA}
                  </strong>{" "}
                  ·{" "}
                  <strong>B {summary.grupoB}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border-l-4 border-l-rose-500 border border-rose-100 bg-rose-50/90 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-900/80">Sin iniciar</p>
                  <p className="mt-2 text-4xl sm:text-5xl font-black tabular-nums text-rose-950">
                    {summary.sucursalesSinIniciar}
                  </p>
                  <p className="mt-1 text-sm font-medium text-rose-900/90">sucursales</p>
                  <p className="mt-2 text-[11px] text-rose-900/70 leading-snug">
                    0% de avance en todas sus bases asignadas.
                  </p>
                </div>
                <div className="rounded-xl border-l-4 border-l-amber-500 border border-amber-100 bg-amber-50/90 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-900/90">
                    <Timer className="h-4 w-4 shrink-0" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-[0.12em]">En progreso</p>
                  </div>
                  <p className="mt-2 text-4xl sm:text-5xl font-black tabular-nums text-amber-950">
                    {summary.sucursalesEnProgreso}
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-900/90">sucursales</p>
                  <p className="mt-2 text-[11px] text-amber-900/75 leading-snug">
                    Ya cargaron algo; aún no terminaron todas las bases.
                  </p>
                </div>
                <div className="rounded-xl border-l-4 border-l-emerald-600 border border-emerald-100 bg-emerald-50/90 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-900/90">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-[0.12em]">Completas</p>
                  </div>
                  <p className="mt-2 text-4xl sm:text-5xl font-black tabular-nums text-emerald-950">
                    {summary.sucursalesCompletas}
                  </p>
                  <p className="mt-1 text-sm font-medium text-emerald-900/90">sucursales</p>
                  <p className="mt-2 text-[11px] text-emerald-900/75 leading-snug">
                    100%: todas las bases con ≥3 recomendaciones.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Secundario: reporting — avance global en bases */}
            <section
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 shadow-sm"
              aria-labelledby="admin-avance-global"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Avance global</p>
                        <div className="flex flex-wrap items-end gap-6 gap-y-3">
                <div>
                  <p id="admin-avance-global" className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900">
                    {summary.pctGlobal}%
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">Avance global (ponderado por bases)</p>
                </div>
                <div className="h-10 w-px bg-slate-200 hidden sm:block" aria-hidden />
                <div>
                  <p className="text-lg sm:text-xl font-bold tabular-nums text-slate-800">
                    {summary.basesComplete} / {summary.basesTotal}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">Bases completadas (todas las sucursales)</p>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-200/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, summary.pctGlobal))}%` }}
                  role="progressbar"
                  aria-valuenow={summary.pctGlobal}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Avance global de bases completadas"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                <strong>Completado</strong> por base = ≥3 recomendaciones. <strong>Grupo A/B</strong> = mitades del Top
                50. Bases pendientes en el mercado: <strong>{summary.basesPending}</strong>.
              </p>
            </section>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            <p className="mt-2 text-xs opacity-90">
              Si acabas de desplegar, aplica la migración{" "}
              <code className="text-[11px]">20260421130000_admin_sucursal_progress_rpc.sql</code> en Supabase.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1 min-w-[12rem]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden />
              <Input
                placeholder="Filtrar por nombre de sucursal…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
                aria-label="Filtrar tabla por sucursal"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 border-slate-200 bg-white"
              disabled={filteredSorted.length === 0}
              onClick={() => void handleExportExcel()}
            >
              <Download className="h-4 w-4 mr-2" aria-hidden />
              Exportar Excel
            </Button>
          </div>
        )}

        {!loading && rows.length > 0 && filterQuery.trim() !== "" && (
          <p className="text-xs text-slate-500">
            Tabla: <strong>{filteredSorted.length}</strong> de <strong>{rows.length}</strong> sucursales coinciden con
            el filtro.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-600">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay perfiles de sucursal (`editor`) en este mercado, o aún no hay datos.
          </p>
        ) : filteredSorted.length === 0 ? (
          <p className="text-sm text-slate-600">Ninguna sucursal coincide con el filtro.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[min(32%,14rem)]">
                    <button
                      type="button"
                      onClick={() => toggleSort("sucursal")}
                      className={cn(
                        "inline-flex items-center gap-1.5 font-medium text-left hover:text-slate-900",
                        sortKey === "sucursal" && "text-slate-900"
                      )}
                    >
                      Sucursal
                      <SortGlyph column="sucursal" />
                    </button>
                  </TableHead>
                  <TableHead className="w-24">
                    <button
                      type="button"
                      onClick={() => toggleSort("grupo")}
                      className="inline-flex items-center gap-1.5 font-medium text-left hover:text-slate-900"
                    >
                      Grupo
                      <SortGlyph column="grupo" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("pct")}
                      className="inline-flex w-full items-center justify-end gap-1.5 font-medium hover:text-slate-900"
                    >
                      %
                      <SortGlyph column="pct" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("complete")}
                      className="inline-flex w-full items-center justify-end gap-1.5 font-medium hover:text-slate-900"
                    >
                      Completos
                      <SortGlyph column="complete" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("partial")}
                      className="inline-flex w-full items-center justify-end gap-1.5 font-medium hover:text-slate-900"
                    >
                      Parciales
                      <SortGlyph column="partial" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("pending")}
                      className="inline-flex w-full items-center justify-end gap-1.5 font-medium hover:text-slate-900"
                    >
                      Pendientes
                      <SortGlyph column="pending" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("bases")}
                      className="inline-flex w-full items-center justify-end gap-1.5 font-medium hover:text-slate-900"
                    >
                      Bases
                      <SortGlyph column="bases" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((r) => {
                  const name = rowLabel(r);
                  const g = grupoLetter(r);
                  return (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800"
                          title={GRUPO_TITLE[g]}
                        >
                          {g}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.pct_complete}%</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700">{r.bases_complete}</TableCell>
                      <TableCell className="text-right tabular-nums text-amber-700">{r.bases_partial}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{r.bases_pending}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">{r.bases_total}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
