import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SessionLoadingScreen } from "@/components/SessionLoadingScreen";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Usuario autenticado en Auth pero sin fila en `profiles` (el administrador debe crearla).
 */
export default function AccountIncomplete() {
  const navigate = useNavigate();
  const { user, profile, loading, profileResolved, signOut } = useAuth();

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
    if (profile) {
      navigate("/", { replace: true });
    }
  }, [navigate, loading, profileResolved, user, profile]);

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (loading || (user != null && !profileResolved)) {
    return <SessionLoadingScreen />;
  }

  if (!user || profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Cuenta sin perfil</h1>
        <p className="text-sm text-muted-foreground">
          Tu usuario existe en el sistema, pero falta la fila en la tabla <code className="text-xs">profiles</code>{" "}
          (mercado, rol, etc.). Pide al administrador que la cree en Supabase junto con tu alta de usuario.
        </p>
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
