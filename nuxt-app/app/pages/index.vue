<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login, isAuthenticated } = useAuth()
const toast = useToast()

const token = ref('')
const loading = ref(false)

if (isAuthenticated.value) {
  await navigateTo('/dashboard')
}

async function handleLogin() {
  loading.value = true
  try {
    await login(token.value)
    await navigateTo('/dashboard')
  } catch (error) {
    toast.add({
      title: '登录失败',
      description: getErrorMessage(error, '访问密钥不正确'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-elevated/50 p-4">
    <div class="w-full max-w-md">
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

        <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
          <UFormField
            label="访问密钥"
            hint="启动服务时配置的 NUXT_ACCESS_TOKEN"
            :ui="{ label: 'shrink-0 whitespace-nowrap' }"
          >
            <UInput
              v-model="token"
              type="password"
              icon="i-lucide-key-round"
              size="xl"
              class="w-full"
              placeholder="请输入访问密钥"
              autocomplete="current-password"
              autofocus
            />
          </UFormField>

          <UButton
            type="submit"
            label="登录"
            color="primary"
            size="xl"
            block
            :loading="loading"
            icon="i-lucide-log-in"
            trailing
          />
        </form>
      </UCard>
    </div>
  </div>
</template>
