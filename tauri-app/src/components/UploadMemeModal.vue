<script setup lang="ts">
import { computed, ref } from "vue";
import { useApi } from "../composables/useApi";
import { useMemes } from "../composables/useMemes";

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { groups, refresh } = useMemes()
const { uploadMemes } = useApi()

const BATCH_SIZE = 20

interface PickedFile {
  file: File
  url: string
}

const files = ref<PickedFile[]>([])
const groupId = ref<string>(groups.value[0]?.id ?? '')
const uploading = ref(false)
const uploadedCount = ref(0)
const failedCount = ref(0)
const dragActive = ref(false)
const fileInput = ref<HTMLInputElement>()

const groupOptions = computed(() => groups.value.map(group => ({ label: group.name, value: group.id })))

const progress = computed(() => {
  if (!files.value.length) {
    return 0
  }
  return Math.round((uploadedCount.value / files.value.length) * 100)
})

function onSelectFiles() {
  fileInput.value?.click()
}

function onFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files || []))
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragActive.value = false
  addFiles(Array.from(event.dataTransfer?.files || []))
}

function addFiles(incoming: File[]) {
  const images = incoming.filter(file => file.type.startsWith('image/'))
  images.forEach(file => files.value.push({ file, url: URL.createObjectURL(file) }))
}

function removeFile(index: number) {
  const item = files.value[index]
  if (item) {
    URL.revokeObjectURL(item.url)
  }
  files.value.splice(index, 1)
}

function reset() {
  files.value.forEach(item => URL.revokeObjectURL(item.url))
  files.value = []
  uploadedCount.value = 0
  failedCount.value = 0
}

async function uploadBatch(batch: PickedFile[]) {
  await uploadMemes(groupId.value, batch.map(item => item.file))
}

async function onSubmit() {
  if (!files.value.length || uploading.value || !groupId.value) {
    return
  }

  uploading.value = true
  uploadedCount.value = 0
  failedCount.value = 0
  const total = files.value.length

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = files.value.slice(i, i + BATCH_SIZE)
      try {
        await uploadBatch(batch)
        uploadedCount.value += batch.length
      } catch {
        failedCount.value += batch.length
      }
    }

    if (failedCount.value === 0) {
      toast.add({ title: '上传成功', description: `已上传 ${total} 个表情`, color: 'success' })
    } else {
      toast.add({ title: '上传完成', description: `成功 ${uploadedCount.value}，失败 ${failedCount.value}`, color: 'warning' })
    }

    open.value = false
    reset()
    await refresh()
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="上传表情"
    :dismissible="!uploading"
    :close="!uploading"
  >
    <template #body>
      <div v-if="uploading" class="flex flex-col gap-3 py-6">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-highlighted">
            正在上传...
          </p>
          <p class="text-xs text-muted">
            {{ uploadedCount }} / {{ files.length }}
          </p>
        </div>
        <UProgress :model-value="progress" />
        <p class="text-xs text-muted">
          已完成 {{ progress }}%，失败 {{ failedCount }} 个
        </p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div
          class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-10 text-center transition-colors"
          :class="dragActive ? 'border-primary bg-primary/5' : 'border-default'"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="onDrop"
        >
          <UIcon name="i-lucide-image-plus" class="size-10 text-dimmed" />
          <p class="text-sm text-muted">
            将图片拖拽到这里，或点击选择文件
          </p>
          <UButton
            label="选择文件"
            icon="i-lucide-folder-open"
            color="primary"
            size="sm"
            @click="onSelectFiles"
          />
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="onFilesChange"
          >
        </div>

        <div v-if="files.length" class="grid grid-cols-4 gap-3 sm:grid-cols-6">
          <div v-for="(item, index) in files" :key="item.url" class="relative">
            <img :src="item.url" :alt="item.file.name" class="aspect-square w-full rounded-lg object-cover">
            <button
              type="button"
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-elevated text-muted ring ring-default hover:text-default"
              @click="removeFile(index)"
            >
              <UIcon name="i-lucide-x" class="size-3" />
            </button>
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
            {{ files.length }} 个文件待上传
          </p>
        </div>
        <p v-else class="text-xs text-muted">
          请先在表情库创建分组，再上传表情
        </p>
      </div>
    </template>

    <template #footer>
      <div v-if="!uploading" class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          label="上传"
          icon="i-lucide-upload"
          color="primary"
          :disabled="!files.length || !groupId"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
