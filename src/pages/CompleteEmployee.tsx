import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SessionLoadingScreen } from "@/components/SessionLoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { needsEmployeeNumber } from "@/lib/profileGuards";
import { normalizeEmployeeNumber } from "@/lib/authLogin";

/**
 * Una sola vez: número de empleado / nómina cuando el administrador no lo cargó en `profiles`.
 * (Distinto del usuario de acceso tipo pinta1.)
 */
export default function CompleteEmployee() {
  const navigate = useNavigate();
  const { user, profile, loading, profileResolved, saveEmployeeNumber, signOut } = useAuth();

  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      navigate("/", { replace: true });
      return;
    }
    if (loading || (user != null && !profileResolved)) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!profile) {
      navigate("/cuenta-incompleta", { replace: true });
      return;
    }
    if (!needsEmployeeNumber(profile)) {
      navigate("/", { replace: true });
    }
  }, [navigate, loading, profileResolved, user, profile]);

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (loading || (user != null && !profileResolved)) {
    return <SessionLoadingScreen />;
  }

  if (!user || !profile || !needsEmployeeNumber(profile)) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const normalized = normalizeEmployeeNumber(value);
    if (!normalized) {
      setMsg("Escribe tu número de empleado (nómina o el que te dio RH).");
      return;
    }
    setBusy(true);
    const { error } = await saveEmployeeNumber(normalized);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">Número de empleado</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Falta tu <strong>número de empleado</strong> (nómina / RH). Es distinto del <strong>usuario</strong> con el
            que entraste (pinta1, honduras12, etc.).
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Número de empleado</label>
          <Input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="ej. 88456"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoFocus
          />
        </div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : "Guardar y continuar"}
        </Button>
        <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
