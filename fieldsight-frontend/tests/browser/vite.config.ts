import { defineConfig } from "vite";
import base from "../../vite.config";
export default defineConfig({ ...base, server: { port: 5174, strictPort: true, proxy: {
  "/api": { target: "http://127.0.0.1:8001", changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""), cookiePathRewrite: { "/auth": "/api/auth" } },
} } });
