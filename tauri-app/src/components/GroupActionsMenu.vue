<script setup lang="ts">
import { computed, ref } from "vue";
import type { DropdownMenuItem } from "@nuxt/ui";
import type { MemeGroup } from "../types";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useMemes } from "../composables/useMemes";

const props = defineProps<{ group: MemeGroup }>()

const { deleteGroup } = useMemes()
const { pending: deleting, run } = useAsyncAction()

const renameOpen = ref(false)
const deleteOpen = ref(false)

const items = computed<DropdownMenuItem[][]>(() => [[
  { label: '重命名', icon: 'i-lucide-pencil', onSelect: () => { renameOpen.value = true } },
  { label: '删除', icon: 'i-lucide-trash', color: 'error', onSelect: () => { deleteOpen.value = true } }
]])

async function onDelete() {
  if (await run(() => deleteGroup(props.group.id), { success: '分组已删除', error: '删除失败' })) {
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
      class="bg-elevated/80 backdrop-blur"
    />
  </UDropdownMenu>

  <GroupFormModal v-model:open="renameOpen" mode="rename" :group="group" />

  <UModal v-model:open="deleteOpen" title="删除分组">
    <template #body>
      <p class="text-sm text-muted">
        确定删除分组「{{ group.name }}」吗？
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
          :loading="deleting"
          @click="onDelete"
        />
      </div>
    </template>
  </UModal>
</template>
