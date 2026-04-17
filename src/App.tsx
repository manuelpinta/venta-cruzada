import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProductCatalogProvider } from "@/context/ProductCatalogContext";
import { RequireProfile } from "@/components/RequireProfile";
import { CampaignGate } from "@/components/CampaignGate";
import { SessionLoadingScreen } from "@/components/SessionLoadingScreen";
import Index from "./pages/Index.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Login from "./pages/Login.tsx";
import AccountIncomplete from "./pages/AccountIncomplete.tsx";
import CompleteEmployee from "./pages/CompleteEmployee.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useAuth } from "@/context/AuthContext";
import { needsEmployeeNumber } from "@/lib/profileGuards";

function LoginRoute() {
  const { user, profile, loading, profileResolved } = useAuth();
  if (loading || (user != null && !profileResolved)) {
    return <SessionLoadingScreen />;
  }
  if (user && profile) {
    if (needsEmployeeNumber(profile)) {
      return <Navigate to="/completar-empleado" replace />;
    }
    return <Navigate to="/" replace />;
  }
  if (user && !profile) {
    return <Navigate to="/cuenta-incompleta" replace />;
  }
  return <Login />;
}

const App = () => (
  <AuthProvider>
    <ProductCatalogProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <CampaignGate>
                  <LoginRoute />
                </CampaignGate>
              }
            />
            <Route
              path="/cuenta-incompleta"
              element={
                <CampaignGate>
                  <AccountIncomplete />
                </CampaignGate>
              }
            />
            <Route
              path="/completar-empleado"
              element={
                <CampaignGate>
                  <CompleteEmployee />
                </CampaignGate>
              }
            />
            <Route
              path="/"
              element={
                <RequireProfile>
                  <CampaignGate>
                    <Index />
                  </CampaignGate>
                </RequireProfile>
              }
            />
            <Route
              path="/producto/:sku"
              element={
                <RequireProfile>
                  <CampaignGate>
                    <ProductDetail />
                  </CampaignGate>
                </RequireProfile>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ProductCatalogProvider>
  </AuthProvider>
);

export default App;
