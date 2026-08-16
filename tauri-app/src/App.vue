<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { listen } from "@tauri-apps/api/event";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useColorMode } from "@vueuse/core";
import { useHeartbeat } from "./composables/useHeartbeat";
import { useSettings } from "./composables/useSettings";
import { useServer } from "./composables/useServer";
import { useGlobalShortcut } from "./composables/useGlobalShortcut";
import { useMemes } from "./composables/useMemes";

const router = useRouter();
const route = useRoute();
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const colorMode = useColorMode();
const themeColor = computed(() => colorMode.value === "dark" ? "#18181b" : "#ffffff");

useHead({
  meta: [
    { name: "theme-color", content: themeColor }
  ]
});

const { status, start: startHeartbeat } = useHeartbeat();
const { baseUrl } = useServer();

const { uiScale, shortcut } = useSettings();
const { apply: applyShortcut } = useGlobalShortcut();
const memes = useMemes();

let unlistenFavorites: (() => void) | undefined;

onMounted(async () => {
  startHeartbeat();
  applyShortcut(shortcut.value);
  if (!isTauri) {
    return;
  }
  unlistenFavorites = await listen("open-favorites", async () => {
    await memes.refresh();
    const favorites = memes.groups.value.find(group => group.isFavorites);
    if (favorites) {
      router.push(`/memes/${favorites.id}`);
    }
  });
});

onUnmounted(() => {
  unlistenFavorites?.();
});

function applyScale() {
  const el = document.documentElement;
  if (uiScale.value === "auto") {
    el.style.fontSize = "";
  } else {
    el.style.fontSize = `${(Number(uiScale.value) / 100) * 16}px`;
  }
}

watch(uiScale, applyScale, { immediate: true });

watch(status, (value) => {
  if (!baseUrl.value) {
    return;
  }
  if (value === "offline" && route.path !== "/settings" && route.path !== "/disconnected" && !route.path.startsWith("/connect")) {
    router.replace("/disconnected");
  } else if (value === "online" && route.path === "/disconnected") {
    router.replace("/dashboard");
  }
});

watch(() => route.path, (path) => {
  if (path === "/disconnected") {
    if (status.value === "online") {
      router.replace("/dashboard");
    }
    return;
  }
  if (status.value === "offline" && path !== "/settings" && !path.startsWith("/connect")) {
    router.replace("/disconnected");
  }
});
</script>

<template>
  <TitleBar />
  <Suspense>
    <UApp>
      <RouterView />
    </UApp>
  </Suspense>
</template>
