<route lang="yaml">
meta:
  layout: connect
</route>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useServer } from "../composables/useServer";
import { useHeartbeat } from "../composables/useHeartbeat";

const router = useRouter();
const { baseUrl } = useServer();
const { status, lastChecked, lastOnlineAt, checkNow } = useHeartbeat();

const lastCheckedText = computed(() => lastChecked.value ? lastChecked.value.toLocaleTimeString() : "—");
const lastOnlineText = computed(() => lastOnlineAt.value ? lastOnlineAt.value.toLocaleString() : "—");
</script>

<template>
  <div class="w-full max-w-md">
    <UCard>
      <template #header>
        <div class="flex flex-col items-center gap-3 py-4 text-center">
          <div class="flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <UIcon name="i-lucide-cloud-off" class="size-7" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-highlighted">
              无法连接服务器
            </h1>
            <p class="mt-1 text-sm text-muted">
              与服务器的连接已中断，请检查服务器是否在运行、网络是否正常
            </p>
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-2 text-sm">
        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0 text-muted">服务器地址</span>
          <span class="truncate font-mono text-highlighted">
            {{ baseUrl }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0 text-muted">最近在线时间</span>
          <span class="text-highlighted">
            {{ lastOnlineText }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0 text-muted">上次检测</span>
          <span class="text-highlighted">
            {{ lastCheckedText }}
          </span>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col gap-2">
          <UButton
            block
            size="lg"
            icon="i-lucide-refresh-cw"
            :loading="status === 'checking'"
            :label="status === 'checking' ? '检测中…' : '立即重试'"
            @click="checkNow"
          />
          <UButton
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-settings"
            label="服务器设置"
            @click="router.push('/settings')"
          />
          <p class="text-center text-xs text-dimmed">
            应用每 3 秒自动重试，服务器恢复后将自动返回
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>
