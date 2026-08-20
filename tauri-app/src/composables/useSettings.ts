import { computed } from "vue";
import { createSharedComposable, useStorage } from "@vueuse/core";

/** 提示弹窗显示时长档位（毫秒）。Nuxt UI 默认 5000ms 偏长，这里默认取「标准」1500ms。 */
export const TOAST_DURATION_PRESETS = {
  fast: 1000,
  normal: 1500,
  slow: 3000
} as const;

export type ToastSpeed = keyof typeof TOAST_DURATION_PRESETS;

export const DEFAULT_TOAST_SPEED: ToastSpeed = "normal";

function normalizeToastSpeed(value: string): ToastSpeed {
  return value in TOAST_DURATION_PRESETS ? (value as ToastSpeed) : DEFAULT_TOAST_SPEED;
}

const _useSettings = () => {
  const copyToast = useStorage("ohmymeme_copy_toast", true);
  const copyPngFallback = useStorage("ohmymeme_copy_png_fallback", true);
  const gifAnimation = useStorage("ohmymeme_gif_animation", true);
  const uiScale = useStorage<string>("ohmymeme_ui_scale", "auto");
  const shortcut = useStorage<string>("ohmymeme_shortcut", "ctrl+alt+n");
  /** 提示弹窗速度档位 */
  const toastSpeed = useStorage<ToastSpeed>("ohmymeme_toast_speed", DEFAULT_TOAST_SPEED);
  /** 拖动排序开关（独立于其他行为设置，默认关闭以免影响点击复制） */
  const dragSort = useStorage("ohmymeme_drag_sort", false);

  /** 传给 <UApp :toaster> 的实际毫秒值 */
  const toastDuration = computed(() => TOAST_DURATION_PRESETS[normalizeToastSpeed(toastSpeed.value)]);

  return {
    copyToast,
    copyPngFallback,
    gifAnimation,
    uiScale,
    shortcut,
    toastSpeed,
    toastDuration,
    dragSort
  };
};

export const useSettings = createSharedComposable(_useSettings);
