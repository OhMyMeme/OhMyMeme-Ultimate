<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { NavigationMenuItem } from "@nuxt/ui";
import { useMemes } from "../composables/useMemes";
import { useRealtime } from "../composables/useRealtime";
import { useHeartbeat } from "../composables/useHeartbeat";

const route = useRoute();
const router = useRouter();
const open = ref(false);
const sidebarCollapsed = ref(false);

const memes = useMemes();
const memeGroups = memes.groups;
await memes.refresh();

useRealtime();

const heartbeat = useHeartbeat();
const statusDotClass = computed(() => {
  switch (heartbeat.status.value) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "checking":
      return "bg-amber-400 animate-pulse";
    default:
      return "bg-zinc-400";
  }
});

const navigationOpen = ref<string[]>(route.path.startsWith("/memes") ? ["memes"] : []);

watch(() => route.path, (path) => {
  const isMemes = path.startsWith("/memes");
  if (isMemes && !navigationOpen.value.includes("memes")) {
    navigationOpen.value = [...navigationOpen.value, "memes"];
  } else if (!isMemes && navigationOpen.value.includes("memes")) {
    navigationOpen.value = navigationOpen.value.filter(v => v !== "memes");
  }
});

const links = computed<NavigationMenuItem[][]>(() => [[{
  label: "总览",
  icon: "i-lucide-house",
  to: "/dashboard",
  onSelect: () => {
    open.value = false;
  }
}, {
  label: "表情库",
  value: "memes",
  icon: "i-lucide-smile",
  to: "/memes",
  defaultOpen: true,
  children: memeGroups.value.map(group => ({
    label: group.name,
    icon: group.isFavorites ? "i-lucide-star" : group.isRecent ? "i-lucide-clock" : group.isUngrouped ? "i-lucide-inbox" : undefined,
    to: `/memes/${group.id}`,
    onSelect: () => {
      open.value = false;
    }
  })),
  onSelect: () => {
    open.value = false;
  }
}]]);
</script>

<template>
  <UDashboardGroup
    unit="rem"
    :persistent="false"
    :class="['top-9', { 'desktop-sidebar-is-collapsed': sidebarCollapsed }]"
  >
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      v-model:collapsed="sidebarCollapsed"
      collapsible
      resizable
      class="desktop-sidebar bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #default="{ collapsed }">
        <UNavigationMenu
          v-model="navigationOpen"
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UButton
          :label="collapsed ? undefined : '设置'"
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          block
          :square="collapsed"
          class="justify-start"
          @click="router.push('/settings')"
        >
          <template #trailing>
            <span class="size-2 rounded-full ring-2 ring-bg" :class="statusDotClass" />
          </template>
        </UButton>
      </template>
    </UDashboardSidebar>

    <RouterView />
  </UDashboardGroup>
</template>
