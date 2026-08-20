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
import { usePlatform } from "./composables/usePlatform";
import { useTheme } from "./composables/useTheme";

const router = useRouter();
const route = useRoute();
const { isTauri, isWindowsTauri } = usePlatform();

const { neutral } = useTheme();

const colorMode = useColorMode();

const NEUTRAL_BG: Record<string, { light: string; dark: string }> = {
  slate: { light: '#f8fafc', dark: '#020617' },
  gray: { light: '#f9fafb', dark: '#030712' },
  zinc: { light: '#fafafa', dark: '#09090b' },
  neutral: { light: '#fafafa', dark: '#0a0a0a' },
  stone: { light: '#fafaf9', dark: '#0c0a09' },
};

const themeColor = computed(() => {
  const colors = NEUTRAL_BG[neutral.value] ?? NEUTRAL_BG.slate;
  return colorMode.value === "dark" ? colors.dark : colors.light;
});

useHead({
  meta: [
    { name: "theme-color", content: themeColor }
  ]
});

const { status, start: startHeartbeat } = useHeartbeat();
const { baseUrl } = useServer();

const { uiScale, shortcut, toastDuration } = useSettings();
const { apply: applyShortcut } = useGlobalShortcut();
const memes = useMemes();

let unlistenFavorites: (() => void) | undefined;

onMounted(async () => {
  if (isWindowsTauri) {
    document.documentElement.classList.add("platform-windows");
  }
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
  <TitleBar v-if="isWindowsTauri" />
  <Suspense>
    <UApp :toaster="{ duration: toastDuration }">
      <RouterView />
    </UApp>
  </Suspense>
</template>
