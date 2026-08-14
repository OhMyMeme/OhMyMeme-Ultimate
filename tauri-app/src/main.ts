import "./assets/css/main.css";

import { createApp } from "vue";
import type { RouteRecordRaw } from "vue-router";
import { createRouter, createWebHistory } from "vue-router";
import { routes, handleHotUpdate } from "vue-router/auto-routes";
import { setupLayouts } from "virtual:generated-layouts";
import { createHead } from "@unhead/vue/client";
import ui from "@nuxt/ui/vue-plugin";

import App from "./App.vue";

const app = createApp(App);

const head = createHead();
const router = createRouter({
  routes: setupLayouts(routes as RouteRecordRaw[]),
  history: createWebHistory()
});

router.beforeEach((to) => {
  const serverUrl = localStorage.getItem("ohmymeme_server_url");
  const sessionToken = localStorage.getItem("ohmymeme_session_token");
  const isConnect = to.path === "/connect" || to.path === "/";
  if ((!serverUrl || !sessionToken) && !isConnect) {
    return "/connect";
  }
});

app.use(head);
app.use(router);
app.use(ui);

app.mount("#app");

if (import.meta.hot) {
  handleHotUpdate(router);
}
