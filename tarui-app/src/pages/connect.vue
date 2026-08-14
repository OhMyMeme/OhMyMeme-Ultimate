<route lang="yaml">
meta:
  layout: connect
</route>
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useServer } from "../composables/useServer";

const router = useRouter();
const toast = useToast();
const { serverUrl, normalizeUrl } = useServer();

const url = ref(serverUrl.value || "");
const testing = ref(false);

async function testConnection(value: string): Promise<boolean> {
  const base = normalizeUrl(value);
  if (!base) {
    return false;
  }
  try {
    const res = await fetch(`${base}/api/overview`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return false;
    }
    const data = await res.json();
    return typeof data?.memeCount === "number" && typeof data?.groupCount === "number";
  } catch {
    return false;
  }
}

async function connect() {
  testing.value = true;
  try {
    const ok = await testConnection(url.value);
    if (!ok) {
      toast.add({ title: "无法连接服务器", description: "请确认地址格式正确（含 http:// 或 https://）且服务端已启动", color: "error" });
      return;
    }
    serverUrl.value = normalizeUrl(url.value);
    toast.add({ title: "连接成功", color: "success" });
    router.push("/dashboard");
  } catch {
    toast.add({ title: "无法连接服务器", description: "请检查地址是否正确、服务端是否已启动", color: "error" });
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
          <UInput
            v-model="url"
            icon="i-lucide-server"
            size="lg"
            class="w-full"
            placeholder="https://your-server.example.com"
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