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
          primary: "rose",
          secondary: "blue",
          success: "green",
          info: "blue",
          warning: "amber",
          error: "red",
          neutral: "slate"
        }
      }
    })
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
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
