import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy: chamadas /api e /webhook vão pro backend Express
    proxy: {
      "/api":     { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/webhook": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
