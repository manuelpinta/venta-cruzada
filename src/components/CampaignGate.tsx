import type { ReactNode } from "react";
import { CampaignLockScreen } from "@/components/CampaignLockScreen";
import { useCampaignDeadline } from "@/lib/campaignDeadline";

/** Tras el fin de campaña, bloquea el contenido y muestra pantalla de cierre. */
export function CampaignGate({ children }: { children: ReactNode }) {
  const { expired } = useCampaignDeadline();
  if (expired) return <CampaignLockScreen />;
  return <>{children}</>;
}
