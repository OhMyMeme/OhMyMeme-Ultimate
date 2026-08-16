import { createSharedComposable, useStorage } from "@vueuse/core";

const _useSettings = () => {
  const copyToast = useStorage("ohmymeme_copy_toast", true);
  const copyPngFallback = useStorage("ohmymeme_copy_png_fallback", true);
  const uiScale = useStorage<string>("ohmymeme_ui_scale", "auto");
  const shortcut = useStorage<string>("ohmymeme_shortcut", "ctrl+alt+n");

  return { copyToast, copyPngFallback, uiScale, shortcut };
};

export const useSettings = createSharedComposable(_useSettings);
