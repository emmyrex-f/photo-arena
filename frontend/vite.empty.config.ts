import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Local-only: proxy to an empty services response. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: "127.0.0.1",
    proxy: {
      "/api": { target: "http://127.0.0.1:3012", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:3012", changeOrigin: true },
    },
  },
});
