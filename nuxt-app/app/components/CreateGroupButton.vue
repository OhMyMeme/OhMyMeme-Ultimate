<script setup lang="ts">
const open = ref(false)
</script>

<template>
  <UButton
    label="新建分组"
    icon="i-lucide-folder-plus"
    color="neutral"
    variant="outline"
    size="sm"
    class="rounded-full"
    :ui="{ label: 'hidden sm:block' }"
    @click="open = true"
  />

  <GroupFormModal v-model:open="open" mode="create" />
</template>
