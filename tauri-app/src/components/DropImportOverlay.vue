<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useMemes } from "../composables/useMemes";
import { useUpload } from "../composables/useUpload";
import { collectFromDataTransfer, type CollectedFile } from "../composables/useFileCollect";

const route = useRoute();
const { groups, refresh, ensureGroup, groupById } = useMemes();

const folderAsGroup = ref(true);
const dragging = ref(false);
const open = ref(false);
let depth = 0;

/** 落地分组：当前分组页优先（收藏/最近使用除外），否则未分组 */
const targetGroupId = computed(() => {
  const params = route.params as Record<string, string | string[]>;
  const raw = Array.isArray(params.group) ? params.group[0] : params.group;
  const current = raw ? groupById(raw) : undefined;
  if (current && !current.isFavorites && !current.isRecent) {
    return current.id;
  }
  return groups.value.find(group => group.isUngrouped)?.id ?? "";
});

const groupId = ref(targetGroupId.value);
watch(targetGroupId, (value) => {
  groupId.value = value;
});

const upload = useUpload(groupId, refresh, { folderAsGroup, ensureGroup });

const targetName = computed(() => groupById(groupId.value)?.name ?? "未分组");

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

/** 弹窗（含上传弹窗自身的拖放区）打开时不接管窗口级拖放，避免重复入列 */
function blocked(): boolean {
  return !open.value && document.body.querySelector("[role=dialog]") !== null;
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event) || blocked()) {
    return;
  }
  depth++;
  dragging.value = true;
}

function onDragOver(event: DragEvent) {
  if (!hasFiles(event) || blocked()) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function onDragLeave() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) {
    dragging.value = false;
  }
}

async function onDrop(event: DragEvent) {
  if (!hasFiles(event) || blocked()) {
    depth = 0;
    dragging.value = false;
    return;
  }
  event.preventDefault();
  depth = 0;
  dragging.value = false;

  const collected: CollectedFile[] = await collectFromDataTransfer(event.dataTransfer);
  if (!collected.length) {
    return;
  }
  if (!groupId.value) {
    await refresh();
    groupId.value = targetGroupId.value;
  }
  open.value = true;
  await upload.addCollected(collected);
  if (!upload.files.length) {
    open.value = false;
  }
}

async function onConfirm() {
  await upload.submit();
  if (upload.failedCount === 0) {
    open.value = false;
    upload.reset();
  }
}

function onCancel() {
  open.value = false;
  upload.reset();
}

onMounted(() => {
  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);
});

onBeforeUnmount(() => {
  window.removeEventListener("dragenter", onDragEnter);
  window.removeEventListener("dragover", onDragOver);
  window.removeEventListener("dragleave", onDragLeave);
  window.removeEventListener("drop", onDrop);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dragging"
      class="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-default/70 backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-elevated/80 px-12 py-10 shadow-xl">
        <UIcon name="i-lucide-image-down" class="size-12 text-primary" />
        <p class="text-base font-semibold text-highlighted">
          松开即导入到「{{ targetName }}」
        </p>
        <p class="text-xs text-muted">
          支持多个图片与文件夹（含子目录）
        </p>
      </div>
    </div>
  </Teleport>

  <AppModal
    v-model:open="open"
    title="导入表情"
    :dismissible="!upload.uploading"
    :closeable="!upload.uploading"
    :footer-divider="false"
    width-class="w-[26rem]"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div v-if="upload.screening" class="flex items-center gap-2 py-4 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          正在校验文件...
        </div>

        <template v-else>
          <p class="text-sm text-highlighted">
            共 {{ upload.uploadableCount }} 个文件待导入
          </p>

          <div v-if="upload.hasFolders" class="flex items-start gap-2 rounded-lg border border-default bg-elevated/40 p-3">
            <UCheckbox v-model="folderAsGroup" />
            <div class="min-w-0">
              <p class="text-xs font-medium text-highlighted">
                按文件夹名自动创建分组
              </p>
              <p class="text-xs text-muted">
                关闭后全部导入「{{ targetName }}」
              </p>
            </div>
          </div>
          <p v-else class="text-xs text-muted">
            将导入到「{{ targetName }}」
          </p>

          <div v-if="upload.uploading" class="flex flex-col gap-2">
            <UProgress :model-value="upload.progress" />
            <p class="text-xs text-muted">
              {{ upload.uploadedBytesText }} / {{ upload.totalBytesText }}（{{ upload.progress }}%）
            </p>
          </div>

          <div
            v-if="upload.failedCount > 0 && !upload.uploading"
            class="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400"
          >
            {{ upload.failedCount }} 个文件导入失败，可点击「重试失败文件」
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <template v-if="!upload.uploading">
        <UButton label="取消" color="neutral" variant="ghost" @click="onCancel" />
        <UButton
          v-if="upload.failedCount > 0"
          label="重试失败文件"
          icon="i-lucide-refresh-cw"
          color="warning"
          @click="upload.retryFailed"
        />
        <UButton
          v-else
          label="开始导入"
          icon="i-lucide-upload"
          color="primary"
          :disabled="!upload.uploadableCount || upload.screening || !groupId"
          @click="onConfirm"
        />
      </template>
    </template>
  </AppModal>
</template>
