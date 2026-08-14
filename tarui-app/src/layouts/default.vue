<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { NavigationMenuItem } from "@nuxt/ui";
import { useMemes } from "../composables/useMemes";

const route = useRoute();
const router = useRouter();
const open = ref(false);

const memes = useMemes();
const memeGroups = memes.groups;
await memes.refresh();

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
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div
          class="flex items-center gap-2.5 py-2"
          :class="[collapsed ? 'justify-center px-1' : 'px-3']"
        >
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-smile" class="size-5" />
          </div>
          <span v-if="!collapsed" class="text-base font-semibold tracking-tight text-highlighted truncate">
            OhMyMeme
          </span>
        </div>
      </template>

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
          :label="collapsed ? undefined : '服务器设置'"
          icon="i-lucide-server"
          color="neutral"
          variant="ghost"
          block
          :square="collapsed"
          class="justify-start"
          @click="router.push('/connect')"
        />
      </template>
    </UDashboardSidebar>

    <RouterView />
  </UDashboardGroup>
</template>