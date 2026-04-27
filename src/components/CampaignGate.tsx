import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CampaignLockScreen } from "@/components/CampaignLockScreen";
import { useAuth } from "@/context/AuthContext";
import { useCampaignDeadline } from "@/lib/campaignDeadline";

/** Tras el fin de campaña, bloquea el contenido y muestra pantalla de cierre. */
export function CampaignGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { expired, loading } = useCampaignDeadline(profile?.country_code);
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const isLoginRoute = location.pathname === "/login";

  // Evita bloqueo "flash" mientras consulta deadline remoto por país.
  if (loading) return <>{children}</>;

  // Después del cierre, solo admins (y login para permitir acceso admin) pueden entrar.
  if (expired && !isAdmin && !isLoginRoute) return <CampaignLockScreen />;
  return <>{children}</>;
}
