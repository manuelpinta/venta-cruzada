import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  /** Permite `NEXT_PUBLIC_*` además de `VITE_*` (p. ej. URL de soporte copiada desde un proyecto Next). */
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Desarrollo local sin Vercel: `server/dev-api.ts` lee MySQL (puerto 8787 por defecto).
      "/api": {
        target: `http://127.0.0.1:${process.env.CATALOG_DEV_API_PORT ?? "8787"}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
