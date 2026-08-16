<script setup lang="ts">
import { useRouter } from "vue-router";
import { useServer } from "../../composables/useServer";
import { useAuth } from "../../composables/useAuth";

const router = useRouter();
const toast = useToast();
const { serverUrl } = useServer();
const { sessionToken, logout } = useAuth();

function clearCache() {
  serverUrl.value = "";
  sessionToken.value = "";
  toast.add({ title: "本地数据已清除", color: "success" });
  router.push("/connect");
}

function logoutAndLeave() {
  logout();
  router.push("/connect");
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-round" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          账号与数据
        </h3>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            退出登录
          </p>
          <p class="text-xs text-muted">
            清除会话令牌，返回连接页
          </p>
        </div>
        <UButton
          label="退出登录"
          icon="i-lucide-log-out"
          color="neutral"
          variant="outline"
          size="sm"
          @click="logoutAndLeave"
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            清除本地数据
          </p>
          <p class="text-xs text-muted">
            删除本地保存的服务器地址与会话令牌
          </p>
        </div>
        <UButton
          label="清除"
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          size="sm"
          @click="clearCache"
        />
      </div>
    </div>
  </UCard>
</template>
