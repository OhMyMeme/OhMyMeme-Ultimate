<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { useUpdater } from "../../composables/useUpdater";

const version = ref("");
const { state, modalOpen, check, downloadAndInstall, installAndRelaunch, close } = useUpdater();

const checking = computed(() => state.phase === "checking");
const downloading = computed(() => state.phase === "downloading");
const ready = computed(() => state.phase === "ready");

const title = computed(() => {
  switch (state.phase) {
    case "downloading":
      return "正在下载更新";
    case "ready":
      return "更新完成";
    case "error":
      return "更新失败";
    default:
      return "发现新版本";
  }
});

const progress = computed(() => {
  if (!state.total) {
    return 0;
  }
  return Math.min(100, Math.round(((state.received ?? 0) / state.total) * 100));
});

onMounted(async () => {
  try {
    version.value = await getVersion();
  } catch {
    version.value = "开发模式";
  }
  check(false);
});
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-upload-cloud" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          更新
        </h3>
      </div>
    </template>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-highlighted">
          OhMyMemeUltimate Desktop
        </p>
        <p class="text-xs text-muted">
          当前版本 {{ version }}
        </p>
      </div>

      <UButton
        label="检查更新"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="checking"
        :disabled="downloading"
        @click="check(true)"
      />
    </div>

    <AppModal v-model:open="modalOpen" :title="title" width-class="w-80">
      <template #body>
        <div class="flex flex-col gap-3">
          <div v-if="state.phase === 'available' || state.phase === 'ready'">
            <p class="text-sm font-medium text-highlighted">
              新版本 {{ state.version }}
            </p>
            <p v-if="state.notes" class="mt-2 whitespace-pre-wrap text-xs text-muted">
              {{ state.notes }}
            </p>
          </div>

          <div v-else-if="state.phase === 'downloading'" class="flex flex-col gap-2">
            <p class="text-sm text-muted">
              正在下载 {{ progress }}%
            </p>
            <UProgress :model-value="progress" />
          </div>

          <p v-else-if="state.phase === 'error'" class="text-sm text-muted">
            {{ state.message }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton
          label="稍后"
          color="neutral"
          variant="outline"
          :disabled="downloading"
          @click="close"
        />
        <UButton
          :label="ready ? '立即重启' : '立即更新'"
          :icon="ready ? 'i-lucide-rotate-ccw' : 'i-lucide-download'"
          color="primary"
          :loading="downloading"
          :disabled="downloading"
          @click="ready ? installAndRelaunch() : downloadAndInstall()"
        />
      </template>
    </AppModal>
  </UCard>
</template>
