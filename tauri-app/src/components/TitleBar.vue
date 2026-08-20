<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const isMaximized = ref(false);

let unlisten: (() => void) | undefined;

onMounted(async () => {
  if (!isTauri) {
    return;
  }
  const win = getCurrentWindow();
  isMaximized.value = await win.isMaximized();
  unlisten = await win.onResized(async () => {
    isMaximized.value = await win.isMaximized();
  });
});

onUnmounted(() => {
  unlisten?.();
});

function minimize() {
  if (isTauri) {
    getCurrentWindow().minimize();
  }
}

function toggleMaximize() {
  if (isTauri) {
    getCurrentWindow().toggleMaximize();
  }
}

function closeWindow() {
  if (isTauri) {
    getCurrentWindow().close();
  }
}
</script>

<template>
  <div
    data-tauri-drag-region="deep"
    class="fixed inset-x-0 top-0 z-50 flex h-9 shrink-0 select-none items-center justify-between border-b border-default bg-elevated/80 backdrop-blur"
  >
    <div class="flex items-center gap-2 pl-3">
      <div class="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
        <UIcon name="i-lucide-smile" class="size-3" />
      </div>
      <span class="text-xs font-semibold tracking-tight text-highlighted">
        OhMyMemeUltimate Desktop
      </span>
    </div>

    <div class="flex h-full items-stretch">
      <button
        type="button"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-elevated hover:text-highlighted"
        title="最小化"
        @click="minimize"
      >
        <UIcon name="i-lucide-minus" class="size-4" />
      </button>
      <button
        type="button"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-elevated hover:text-highlighted"
        :title="isMaximized ? '还原' : '最大化'"
        @click="toggleMaximize"
      >
        <UIcon :name="isMaximized ? 'i-lucide-copy' : 'i-lucide-square'" class="size-4" />
      </button>
      <button
        type="button"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-red-500 hover:text-white"
        title="关闭"
        @click="closeWindow"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
  </div>
</template>
