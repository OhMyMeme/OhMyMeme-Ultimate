<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMemes } from "../composables/useMemes";
import { useUpload, MAX_IMAGE_EDGE } from "../composables/useUpload";
import { collectFromDataTransfer, collectFromInput } from "../composables/useFileCollect";

const open = defineModel<boolean>('open', { default: false })

const { groups, refresh, ensureGroup } = useMemes();
const folderAsGroup = ref(true);
const groupId = ref<string>(groups.value.find(group => group.isUngrouped)?.id ?? groups.value.find(group => !group.isFavorites && !group.isRecent)?.id ?? '');

const groupOptions = computed(() => groups.value.filter(group => !group.isFavorites && !group.isRecent).map(group => ({ label: group.name, value: group.id })));

watch(groups, (value) => {
  if (!value.some(group => group.id === groupId.value)) {
    groupId.value = value.find(group => group.isUngrouped)?.id ?? value.find(group => !group.isFavorites && !group.isRecent)?.id ?? ''
  }
})

const upload = useUpload(groupId, refresh, { folderAsGroup, ensureGroup });

const dragActive = ref(false);
const fileInput = ref<HTMLInputElement>();
const folderInput = ref<HTMLInputElement>();

function onSelectFiles() {
  fileInput.value?.click();
}

function onSelectFolder() {
  folderInput.value?.click();
}

async function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement;
  await upload.addFiles(Array.from(input.files || []));
  input.value = '';
}

async function onFolderChange(event: Event) {
  const input = event.target as HTMLInputElement;
  await upload.addCollected(collectFromInput(input));
  input.value = '';
}

async function onDrop(event: DragEvent) {
  dragActive.value = false;
  await upload.addCollected(await collectFromDataTransfer(event.dataTransfer));
}

async function onSubmit() {
  await upload.submit();
  if (upload.failedCount === 0) {
    open.value = false;
    upload.reset();
  }
}
</script>

<template>
  <AppModal
    v-model:open="open"
    title="上传表情"
    :dismissible="!upload.uploading"
    :closeable="!upload.uploading"
    :footer-divider="false"
    width-class="w-[28rem]"
  >
    <template #body>
      <div v-if="upload.uploading" class="flex flex-col gap-3 py-6">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-highlighted">
            正在上传...
          </p>
          <p class="text-xs text-muted">
            {{ upload.doneCount + upload.failedCount }} / {{ upload.uploadableCount }}
          </p>
        </div>
        <UProgress :model-value="upload.progress" />
        <p class="text-xs text-muted">
          {{ upload.uploadedBytesText }} / {{ upload.totalBytesText }}（{{ upload.progress }}%）
          <span v-if="upload.failedCount">，失败 {{ upload.failedCount }} 个</span>
        </p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div
          class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-10 text-center transition-colors"
          :class="dragActive ? 'border-primary bg-primary/5' : 'border-default'"
          @dragenter.stop
          @dragover.prevent.stop="dragActive = true"
          @dragleave.prevent.stop="dragActive = false"
          @drop.prevent.stop="onDrop"
        >
          <UIcon v-if="upload.screening" name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
          <UIcon v-else name="i-lucide-image-plus" class="size-10 text-dimmed" />
          <p class="text-sm text-muted">
            {{ upload.screening ? '正在校验文件...' : '将图片或文件夹拖拽到这里' }}
          </p>
          <p class="text-xs text-dimmed">
            支持 PNG / JPEG / GIF / WebP，单个不超过 20MB，最长边不超过 {{ MAX_IMAGE_EDGE }}px
          </p>
          <div class="flex items-center gap-2">
            <UButton
              label="选择文件"
              icon="i-lucide-image"
              color="primary"
              size="sm"
              :disabled="upload.screening"
              @click="onSelectFiles"
            />
            <UButton
              label="选择文件夹"
              icon="i-lucide-folder-open"
              color="neutral"
              variant="subtle"
              size="sm"
              :disabled="upload.screening"
              @click="onSelectFolder"
            />
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            class="hidden"
            @change="onFilesChange"
          >
          <input
            ref="folderInput"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            webkitdirectory
            class="hidden"
            @change="onFolderChange"
          >
        </div>

        <div v-if="upload.files.length" class="grid grid-cols-4 gap-3 sm:grid-cols-6">
          <div v-for="(item, index) in upload.files" :key="item.url" class="relative">
            <img
              :src="item.url"
              :alt="item.file.name"
              class="aspect-square w-full rounded-lg object-cover"
              :class="item.status === 'failed' ? 'opacity-60' : ''"
            >

            <div
              v-if="item.status === 'uploading'"
              class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"
            >
              <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-white" />
            </div>
            <div
              v-else-if="item.status === 'success'"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-lg bg-green-500/80 py-0.5"
            >
              <UIcon name="i-lucide-check" class="size-3 text-white" />
            </div>
            <div
              v-else-if="item.status === 'failed'"
              :title="item.reason"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-lg bg-red-500/80 py-0.5"
            >
              <UIcon name="i-lucide-x" class="size-3 text-white" />
            </div>

            <button
              type="button"
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-elevated text-muted ring ring-default hover:text-default"
              @click="upload.removeFile(index)"
            >
              <UIcon name="i-lucide-x" class="size-3" />
            </button>
          </div>
        </div>

        <div
          v-if="upload.failedCount > 0 && !upload.uploading"
          class="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400"
        >
          {{ upload.failedCount }} 个文件上传失败，可悬停缩略图查看原因，或点击「重试失败文件」
        </div>

        <div v-if="upload.hasFolders" class="flex items-start gap-2 rounded-lg border border-default bg-elevated/40 p-3">
          <UCheckbox v-model="folderAsGroup" />
          <div class="min-w-0">
            <p class="text-xs font-medium text-highlighted">
              按文件夹名自动创建分组
            </p>
            <p class="text-xs text-muted">
              关闭后全部上传到下方选定的分组
            </p>
          </div>
        </div>

        <div v-if="groupOptions.length" class="flex items-center justify-between gap-4">
          <UFormField label="上传到分组" class="w-48">
            <USelectMenu
              v-model="groupId"
              value-key="value"
              label-key="label"
              :items="groupOptions"
            />
          </UFormField>
          <p class="text-xs text-muted">
            {{ upload.uploadableCount }} 个文件待上传
          </p>
        </div>
        <p v-else class="text-xs text-muted">
          请先在表情库创建分组，再上传表情
        </p>
      </div>
    </template>

    <template #footer>
      <template v-if="!upload.uploading">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          v-if="upload.failedCount > 0"
          label="重试失败文件"
          icon="i-lucide-refresh-cw"
          color="warning"
          @click="upload.retryFailed"
        />
        <UButton
          label="上传"
          icon="i-lucide-upload"
          color="primary"
          :disabled="!upload.uploadableCount || !groupId"
          @click="onSubmit"
        />
      </template>
    </template>
  </AppModal>
</template>
