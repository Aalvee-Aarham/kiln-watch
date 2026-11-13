import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: the Python API runs on :8000 and serves /api and /data.
const api = process.env.KW_API ?? "http://127.0.0.1:8000"; // KW_API=http://127.0.0.1:8002 to point at another API port
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": api, "/data": api, "/mcp": api } },
});
