import { onScopeDispose, ref, watch } from "vue";
import { createSharedComposable } from "@vueuse/core";
import { useServer } from "./useServer";

export type HeartbeatStatus = "idle" | "checking" | "online" | "offline"

const ONLINE_INTERVAL = 15 * 1000
const OFFLINE_INTERVAL = 30 * 1000
const TIMEOUT = 5 * 1000

const _useHeartbeat = () => {
  const { baseUrl } = useServer();

  const status = ref<HeartbeatStatus>("idle");
  const latency = ref<number | null>(null);
  const lastChecked = ref<Date | null>(null);
  const lastOnlineAt = ref<Date | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function schedule() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!running) {
      return;
    }
    // 宕机后按更长间隔继续探测，以便服务器恢复后自动回到在线（disconnected 页承诺的自动恢复）
    timer = setTimeout(check, status.value === "offline" ? OFFLINE_INTERVAL : ONLINE_INTERVAL);
  }

  async function check() {
    if (!baseUrl.value) {
      status.value = "idle";
      latency.value = null;
      return;
    }

    status.value = "checking";
    const start = performance.now();
    try {
      const res = await fetch(`${baseUrl.value}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      latency.value = Math.round(performance.now() - start);
      status.value = "online";
      lastOnlineAt.value = new Date();
    } catch {
      latency.value = null;
      status.value = "offline";
    } finally {
      lastChecked.value = new Date();
      schedule();
    }
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    check();
  }

  function stop() {
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  watch(baseUrl, () => {
    if (running) {
      check();
    }
  });

  onScopeDispose(stop);

  return { status, latency, lastChecked, lastOnlineAt, checkNow: check, start, stop };
};

export const useHeartbeat = createSharedComposable(_useHeartbeat);
