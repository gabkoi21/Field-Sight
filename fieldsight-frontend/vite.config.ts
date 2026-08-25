import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPaths = [
  "/auth",
  "/enumerators",
  "/health",
  "/organization",
  "/organizations",
  "/sectors",
  "/status",
  "/users",
];

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      apiPaths.map((path) => [
        path,
        {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          bypass: (request) =>
            request.headers.accept?.includes("text/html") ? request.url : undefined,
        },
      ]),
    ),
  },
});