/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [tailwindcss(), viteReact(), basicSsl()],
    server: {
      proxy: {
        "/__/auth": {
          target: `https://${env.VITE_FIREBASE_AUTH_DOMAIN}`,
          changeOrigin: true,
        },
      },
    },
    test: {
      fileParallelism: false,
    },
  };
});
