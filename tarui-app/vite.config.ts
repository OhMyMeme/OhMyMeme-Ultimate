// @ts-ignore

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueRouter from "vue-router/vite";
import vueLayouts from "vite-plugin-vue-layouts";
import ui from "@nuxt/ui/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    vueRouter({
      dts: "src/route-map.d.ts"
    }),
    vueLayouts(),
    vue(),
    ui({
      ui: {
        colors: {
          primary: "green",
          neutral: "zinc"
        }
      }
    })
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  }
}));
