import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    build: {
      outDir: "dist/client",
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      proxy: {
        "/eventmesh/dashboard": {
          target: env.VITE_EVENTMESH_API_PROXY_TARGET || "http://127.0.0.1:9898",
          changeOrigin: true,
        },
      },
      warmup: {
        clientFiles: ["./src/main.tsx"],
      },
    },
    plugins: [react()],
  };
});
