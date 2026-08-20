import { reactive, ref } from "vue";
import { createSharedComposable } from "@vueuse/core";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getErrorMessage } from "../utils/error";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

const _useUpdater = () => {
  const toast = useToast();

  const state = reactive<{
    phase: UpdatePhase;
    version?: string;
    notes?: string;
    received?: number;
    total?: number;
    message?: string;
  }>({ phase: "idle" });
  const modalOpen = ref(false);

  let update: Update | null = null;

  async function check(verbose = false) {
    if (!isTauri) {
      return;
    }
    state.phase = "checking";
    try {
      const found = await checkUpdate();
      if (!found) {
        state.phase = "idle";
        if (verbose) {
          toast.add({ title: "检查更新", description: "已是最新版本", color: "success" });
        }
        return;
      }
      update = found;
      state.version = found.version;
      state.notes = found.body || "";
      state.message = undefined;
      state.phase = "available";
      modalOpen.value = true;
    } catch (error) {
      state.phase = "idle";
      toast.add({ title: "检查更新失败", description: getErrorMessage(error), color: "error" });
    }
  }

  async function downloadAndInstall() {
    if (!isTauri || !update) {
      return;
    }
    state.phase = "downloading";
    state.received = 0;
    state.total = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          state.total = event.data.contentLength;
        } else if (event.event === "Progress") {
          state.received = (state.received ?? 0) + event.data.chunkLength;
        }
      });
      state.phase = "ready";
      toast.add({ title: "更新已下载完成", description: "重启应用以完成更新", color: "success" });
    } catch (error) {
      state.phase = "error";
      state.message = getErrorMessage(error);
      toast.add({ title: "更新下载失败", description: state.message, color: "error" });
    }
  }

  async function installAndRelaunch() {
    if (!isTauri) {
      return;
    }
    try {
      await relaunch();
    } catch (error) {
      toast.add({ title: "重启失败", description: getErrorMessage(error), color: "error" });
    }
  }

  function close() {
    modalOpen.value = false;
  }

  return { state, modalOpen, check, downloadAndInstall, installAndRelaunch, close };
};

export const useUpdater = createSharedComposable(_useUpdater);
