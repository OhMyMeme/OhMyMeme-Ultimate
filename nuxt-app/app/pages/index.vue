<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const { login, isAuthenticated } = useAuth()
const loading = ref(false)

if (isAuthenticated.value) {
  await navigateTo('/dashboard')
}

async function handleLogin() {
  loading.value = true
  login()
  await navigateTo('/dashboard')
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-elevated/50 p-4">
    <div class="w-full max-w-sm">
      <UCard class="text-center">
        <template #header>
          <div class="flex flex-col items-center gap-4">
            <div class="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-smile" class="size-8" />
            </div>
            <div>
              <h1 class="text-xl font-bold tracking-tight text-highlighted">
                OhMyMeme
              </h1>
              <p class="mt-1 text-sm text-muted">
                云端表情包管理系统
              </p>
            </div>
          </div>
        </template>

        <template #footer>
          <UButton
            label="进入管理面板"
            color="primary"
            size="lg"
            block
            :loading="loading"
            icon="i-lucide-arrow-right"
            trailing
            @click="handleLogin"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
