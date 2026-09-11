import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    build: {
      outDir: "dist/client",
    },
    optimizeDeps: {
      include: ["vue", "vue-router", "pinia", "tdesign-vue-next"],
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
        clientFiles: ["./src/main.ts"],
      },
    },
    plugins: [vue()],
  };
});
