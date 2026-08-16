import { computed, ref, watch } from "vue";
import { useWebSocket } from "@vueuse/core";
import { useServer } from "./useServer";
import { useAuth } from "./useAuth";
import { useMemes } from "./useMemes";

function toWsUrl(baseUrl: string): string {
  return baseUrl.replace(/^http/, "ws");
}

export function useRealtime() {
  const { baseUrl } = useServer();
  const { sessionToken } = useAuth();
  const memes = useMemes();

  const lastRevision = ref(0);

  const url = computed(() => {
    if (!baseUrl.value || !sessionToken.value) {
      return undefined;
    }
    return `${toWsUrl(baseUrl.value)}/ws?token=${encodeURIComponent(sessionToken.value)}`;
  });

  const { status, open, close } = useWebSocket(url, {
    immediate: false,
    autoConnect: false,
    autoReconnect: { retries: Infinity, delay: 2000 },
    onMessage: (_ws, event) => {
      try {
        const message = JSON.parse(event.data);
        const revision = typeof message?.revision === "number" ? message.revision : 0;
        if (message?.type === "sync") {
          if (lastRevision.value > 0 && revision > lastRevision.value) {
            memes.refresh();
            memes.bumpRevision();
          }
          lastRevision.value = Math.max(lastRevision.value, revision);
        } else if (message?.type === "groups-changed" || message?.type === "memes-changed") {
          lastRevision.value = Math.max(lastRevision.value, revision);
          memes.refresh();
          memes.bumpRevision();
        }
      } catch {
        // ignore non-JSON messages
      }
    }
  });

  watch(url, (value) => {
    if (value) {
      open();
    } else {
      close();
    }
  }, { immediate: true });

  return { status };
}
