<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useServer } from "../../composables/useServer";
import { useAuth } from "../../composables/useAuth";
import { useHeartbeat } from "../../composables/useHeartbeat";

const router = useRouter();
const toast = useToast();
const { serverUrl, baseUrl, normalizeUrl } = useServer();
const { logout } = useAuth();
const { status, latency, lastChecked, checkNow } = useHeartbeat();

const url = ref(serverUrl.value);
const saving = ref(false);

const badge = computed(() => {
  switch (status.value) {
    case "online":
      return { label: "在线", color: "success" as const };
    case "offline":
      return { label: "离线", color: "error" as const };
    case "checking":
      return { label: "检测中", color: "neutral" as const };
    default:
      return { label: "未检测", color: "neutral" as const };
  }
});

const checkedText = computed(() => lastChecked.value ? lastChecked.value.toLocaleTimeString() : "—");
const latencyText = computed(() => latency.value !== null ? `${latency.value} ms` : "—");

async function save() {
  const base = normalizeUrl(url.value);
  if (!base) {
    toast.add({ title: "保存失败", description: "请填写有效的服务器地址", color: "error" });
    return;
  }

  saving.value = true;
  try {
    if (base !== baseUrl.value) {
      logout();
      serverUrl.value = base;
      toast.add({ title: "服务器已更换", description: "请重新登录以获取新会话", color: "warning" });
      router.push("/connect");
      return;
    }
    toast.add({ title: "已保存", color: "success" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-server" class="size-4 text-dimmed" />
          <h3 class="text-sm font-semibold text-highlighted">
            服务器
          </h3>
        </div>
        <UBadge :label="badge.label" :color="badge.color" variant="soft" />
      </div>
    </template>

    <UForm class="flex flex-col gap-2" @submit.prevent="save">
      <div class="flex items-center gap-2">
        <UInput
          v-model="url"
          icon="i-lucide-server"
          placeholder="http://localhost:3000"
          class="flex-1"
        />
        <UButton
          type="submit"
          label="保存"
          icon="i-lucide-check"
          :loading="saving"
        />
        <UButton
          label="立即检测"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="status === 'checking'"
          @click="checkNow"
        />
      </div>
      <p class="text-xs text-muted">
        修改地址后需要重新登录
      </p>
    </UForm>

    <template #footer>
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="flex items-center gap-1.5 text-muted">
          延迟
          <b class="font-medium text-highlighted">
            {{ latencyText }}
          </b>
        </span>
        <span class="flex items-center gap-1.5 text-muted">
          最近检测
          <b class="font-medium text-highlighted">
            {{ checkedText }}
          </b>
        </span>
      </div>
    </template>
  </UCard>
</template>
