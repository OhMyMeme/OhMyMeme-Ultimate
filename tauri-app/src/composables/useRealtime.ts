import { computed, watch } from "vue";
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

  const url = computed(() => {
    if (!baseUrl.value || !sessionToken.value) {
      return undefined;
    }
    return `${toWsUrl(baseUrl.value)}/ws?token=${encodeURIComponent(sessionToken.value)}`;
  });

  const { status, open, close } = useWebSocket(url, {
    immediate: false,
    autoConnect: false,
    autoReconnect: { retries: 3, delay: 2000 },
    onMessage: (_ws, event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "groups-changed" || message?.type === "memes-changed") {
          memes.refresh();
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
