import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { SessionLoadingScreen } from "@/components/SessionLoadingScreen";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { needsEmployeeNumber } from "@/lib/profileGuards";

/**
 * Con Supabase: sesión, `profiles` con mercado (admin), y número de empleado si hace falta.
 */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileResolved } = useAuth();

  if (!isSupabaseConfigured()) {
    return children;
  }

  if (loading || (user != null && !profileResolved)) {
    return <SessionLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/cuenta-incompleta" replace />;
  }

  if (needsEmployeeNumber(profile)) {
    return <Navigate to="/completar-empleado" replace />;
  }

  return children;
}
