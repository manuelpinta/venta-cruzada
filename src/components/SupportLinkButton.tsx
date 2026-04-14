import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupportUrl } from "@/lib/supportUrl";

type Props = {
  className?: string;
};

/** Enlace a soporte si hay `VITE_SUPPORT_URL` o `NEXT_PUBLIC_SUPPORT_URL` en el entorno. */
export function SupportLinkButton({ className }: Props) {
  const url = getSupportUrl();
  if (!url) return null;

  return (
    <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${className ?? ""}`} asChild>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar a soporte (se abre en una pestaña nueva)"
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Contactar a soporte
      </a>
    </Button>
  );
}
