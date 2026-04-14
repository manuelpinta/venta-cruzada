import { Loader2 } from "lucide-react";

type SessionLoadingScreenProps = {
  title?: string;
  description?: string;
};

/**
 * Pantalla unificada mientras Supabase hidrata la sesión y se resuelve el perfil.
 * Tras limpiar caché o en red lenta puede mostrarse varios segundos; el spinner evita la sensación de “pantalla colgada”.
 */
export function SessionLoadingScreen({
  title = "Cargando sesión",
  description = "Comprobando tu cuenta y permisos…",
}: SessionLoadingScreenProps) {
  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
      <div className="flex flex-col items-center gap-1.5 text-center max-w-sm">
        <p className="text-foreground text-base font-medium">{title}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
