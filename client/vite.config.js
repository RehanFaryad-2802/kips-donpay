import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the client runs on its own port (5173) and proxies /api calls
// to the Express server (4000) so the app can just fetch("/api/...").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
