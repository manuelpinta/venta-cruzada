import { Button } from "@/components/ui/button";
import { SupportLinkButton } from "@/components/SupportLinkButton";
import { useAuth } from "@/context/AuthContext";

/**
 * Pantalla de bloqueo cuando la campaña ya terminó (después del 26 abr 23:59 hora centro MX).
 */
export function CampaignLockScreen() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Campaña cerrada</p>
        <h1 className="text-xl font-extrabold text-slate-900">Venta cruzada finalizada</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          El plazo terminó el <strong>26 de abril de 2026</strong> a las <strong>23:59:59</strong> (hora del centro de
          México). A partir del <strong>27 de abril</strong> esta aplicación ya no está disponible para capturar
          recomendaciones.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <SupportLinkButton />
          <Button variant="outline" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
