<route lang="yaml">
meta:
  layout: connect
</route>
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useServer } from "../composables/useServer";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const toast = useToast();
const { serverUrl, normalizeUrl } = useServer();
const { login } = useAuth();

const url = ref(serverUrl.value || "");
const accessToken = ref("");
const testing = ref(false);
const probing = ref(false);
const reachable = ref<boolean | null>(null);

async function probe() {
  const base = normalizeUrl(url.value);
  if (!base) {
    toast.add({ title: "请先填写服务器地址", color: "error" });
    return;
  }
  probing.value = true;
  reachable.value = null;
  try {
    const res = await fetch(`${base}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    reachable.value = res.ok;
  } catch {
    reachable.value = false;
  } finally {
    probing.value = false;
    toast.add({
      title: reachable.value ? "服务器可达" : "无法连接服务器",
      color: reachable.value ? "success" : "error"
    });
  }
}

async function connect() {
  testing.value = true;
  try {
    const base = normalizeUrl(url.value);
    if (!base) {
      toast.add({ title: "连接失败", description: "请填写有效的服务器地址", color: "error" });
      return;
    }
    serverUrl.value = base;
    await login(accessToken.value);
    toast.add({ title: "连接成功", color: "success" });
    router.push("/dashboard");
  } catch (error) {
    const message = error instanceof Error ? error.message : "请检查地址与访问密钥是否正确";
    toast.add({ title: "连接失败", description: message, color: "error" });
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-md">
    <UCard>
      <template #header>
        <div class="flex flex-col items-center gap-3 py-4 text-center">
          <div class="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-smile" class="size-7" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-highlighted">
              OhMyMeme Desktop
            </h1>
            <p class="mt-1 text-sm text-muted">
              连接到表情包管理服务器
            </p>
          </div>
        </div>
      </template>

      <UForm class="flex flex-col gap-4" @submit.prevent="connect">
        <UFormField label="服务器地址" hint="本地调试填 http://localhost:3000">
          <div class="flex gap-2">
            <UInput
              v-model="url"
              icon="i-lucide-server"
              size="lg"
              class="w-full"
              placeholder="https://your-server.example.com"
            />
            <UButton
              icon="i-lucide-plug-zap"
              size="lg"
              color="neutral"
              variant="outline"
              :loading="probing"
              @click="probe"
            />
          </div>
          <p v-if="reachable === true" class="mt-1.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <UIcon name="i-lucide-circle-check" class="size-3.5" />
            服务器可达
          </p>
          <p v-else-if="reachable === false" class="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <UIcon name="i-lucide-circle-x" class="size-3.5" />
            无法连接，请检查地址或服务是否启动
          </p>
        </UFormField>

        <UFormField label="访问密钥" hint="输入服务端启动时配置的 NUXT_ACCESS_TOKEN">
          <UInput
            v-model="accessToken"
            type="password"
            icon="i-lucide-key-round"
            size="lg"
            class="w-full"
            placeholder="请输入访问密钥"
          />
        </UFormField>

        <UButton
          type="submit"
          size="lg"
          block
          :loading="testing"
          :label="testing ? '连接中…' : '连接'"
        />
      </UForm>

      <template #footer>
        <p class="text-center text-xs text-dimmed">
          地址需指向已运行的 OhMyMeme 服务端 API
        </p>
      </template>
    </UCard>
  </div>
</template>