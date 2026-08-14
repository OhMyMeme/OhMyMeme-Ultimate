import { computed } from "vue";
import { createSharedComposable, useStorage } from "@vueuse/core";

function normalizeUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

const _useServer = () => {
  const serverUrl = useStorage<string>("ohmymeme_server_url", "");

  const baseUrl = computed(() => normalizeUrl(serverUrl.value));

  const isConfigured = computed(() => Boolean(baseUrl.value));

  function resolveUrl(path: string) {
    return `${baseUrl.value}${path}`;
  }

  return { serverUrl, baseUrl, isConfigured, resolveUrl, normalizeUrl };
};

export const useServer = createSharedComposable(_useServer);