import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Supabase no está configurado. Añade <code className="text-xs">VITE_SUPABASE_URL</code> y clave pública en{" "}
          <code className="text-xs">.env.local</code>.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { error } = await signIn(username, password);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-blue-700">Admin Retail</p>
          <h1 className="text-2xl font-extrabold text-slate-900">Venta Cruzada PDV</h1>
          <p className="text-xs text-slate-500">Ingresa con tu número de empleado y contraseña asignada.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Usuario</label>
            <Input
              type="text"
              inputMode="text"
              autoComplete="username"
              placeholder="ej. 9000"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-slate-200 bg-slate-50"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Contraseña</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-200 bg-slate-50"
              required
              minLength={6}
            />
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold" disabled={busy}>
            {busy ? "Validando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
