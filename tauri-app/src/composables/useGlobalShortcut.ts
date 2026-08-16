import { invoke } from "@tauri-apps/api/core";
import { createSharedComposable } from "@vueuse/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const _useGlobalShortcut = () => {
  async function apply(shortcut: string): Promise<string | null> {
    if (!isTauri) {
      return null;
    }
    try {
      await invoke("set_global_shortcut", { shortcut });
      return null;
    } catch (error) {
      return String(error);
    }
  }

  return { apply };
};

export const useGlobalShortcut = createSharedComposable(_useGlobalShortcut);
