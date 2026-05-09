import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    proxy: {
      "/__/auth": {
        target: "https://poohma.firebaseapp.com",
        changeOrigin: true,
      },
    },
  },
});

export default config;
