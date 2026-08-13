<script setup lang="ts">
const open = ref(false)
</script>

<template>
  <UButton
    label="上传表情"
    icon="i-lucide-upload"
    color="primary"
    size="sm"
    class="rounded-full"
    :ui="{ label: 'hidden sm:block' }"
    @click="open = true"
  />

  <UploadMemeModal v-model:open="open" />
</template>
