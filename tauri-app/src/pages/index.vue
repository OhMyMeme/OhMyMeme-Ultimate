<route lang="yaml">
meta:
  layout: connect
</route>
<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useServer } from "../composables/useServer";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { isConfigured } = useServer();
const { isAuthenticated } = useAuth();

onMounted(() => {
  router.replace(isConfigured.value && isAuthenticated.value ? "/dashboard" : "/connect");
});
</script>

<template>
  <div class="flex flex-col items-center gap-4 text-muted">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
    <p class="text-sm">
      正在加载…
    </p>
  </div>
</template>