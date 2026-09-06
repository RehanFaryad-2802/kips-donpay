import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No dev proxy needed here: `vercel dev` (run via `npm run dev`) serves the
// Vite app AND the /api serverless functions together on one port, the same
// way they'll both run in production on Vercel.
export default defineConfig({
  plugins: [react()],
});
