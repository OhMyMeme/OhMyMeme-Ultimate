<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Meme } from "../types";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useMemes } from "../composables/useMemes";

const props = defineProps<{ meme: Meme }>()

const { groups, updateMeme, deleteMeme } = useMemes()
const { pending, run } = useAsyncAction()

const renameOpen = ref(false)
const moveOpen = ref(false)
const deleteOpen = ref(false)
const name = ref('')
const targetGroupId = ref('')

const groupOptions = computed(() =>
  groups.value.filter(group => group.id !== props.meme.groupId && !group.isFavorites && !group.isRecent).map(group => ({ label: group.name, value: group.id }))
)

watch(renameOpen, (value) => {
  if (value) {
    name.value = props.meme.name
  }
})

watch(moveOpen, (value) => {
  if (value) {
    targetGroupId.value = groupOptions.value[0]?.value ?? ''
  }
})

const items = computed<DropdownMenuItem[][]>(() => [[
  { label: '重命名', icon: 'i-lucide-pencil', onSelect: () => { renameOpen.value = true } },
  { label: '移动', icon: 'i-lucide-arrow-right-left', onSelect: () => { moveOpen.value = true } },
  { label: '删除', icon: 'i-lucide-trash', color: 'error', onSelect: () => { deleteOpen.value = true } }
]])

async function onRename() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    return
  }
  if (await run(() => updateMeme(props.meme.id, { name: trimmed }), { success: '已重命名' })) {
    renameOpen.value = false
  }
}

async function onMove() {
  if (!targetGroupId.value) {
    return
  }
  if (await run(() => updateMeme(props.meme.id, { groupId: targetGroupId.value }), { success: '已移动' })) {
    moveOpen.value = false
  }
}

async function onDelete() {
  if (await run(() => deleteMeme(props.meme.id), { success: '已删除' })) {
    deleteOpen.value = false
  }
}
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      icon="i-lucide-ellipsis-vertical"
      color="neutral"
      variant="ghost"
      size="sm"
      title="更多操作"
      class="bg-elevated/80 backdrop-blur"
    />
  </UDropdownMenu>

  <UModal v-model:open="renameOpen" title="重命名表情">
    <template #body>
      <UFormField label="名称" required>
        <UInput v-model="name" placeholder="输入名称" />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="renameOpen = false"
        />
        <UButton
          label="确定"
          color="primary"
          :loading="pending"
          :disabled="!name.trim()"
          @click="onRename"
        />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="moveOpen" title="移动表情">
    <template #body>
      <UFormField v-if="groupOptions.length" label="移动到分组">
        <USelectMenu
          v-model="targetGroupId"
          value-key="value"
          label-key="label"
          :items="groupOptions"
        />
      </UFormField>
      <p v-else class="text-sm text-muted">
        暂无其他分组可移动
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="moveOpen = false"
        />
        <UButton
          label="移动"
          color="primary"
          :loading="pending"
          :disabled="!targetGroupId"
          @click="onMove"
        />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="deleteOpen" title="删除表情">
    <template #body>
      <p class="text-sm text-muted">
        确定删除该表情吗？此操作不可恢复。
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          @click="deleteOpen = false"
        />
        <UButton
          label="删除"
          color="error"
          :loading="pending"
          @click="onDelete"
        />
      </div>
    </template>
  </UModal>
</template>
