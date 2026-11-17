import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build`       → dist/ (served by the Express API, talks to /api)
// `npm run build:demo`  → dist-demo/index.html, one self-contained file whose data lives in the browser (preview / offline demo)
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  define: { __DEMO__: JSON.stringify(mode === "demo") },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist", chunkSizeWarningLimit: 4000 },
  server: { port: 5173, proxy: { "/api": "http://localhost:4000" } },
}));
