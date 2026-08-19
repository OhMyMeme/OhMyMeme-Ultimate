import { watch } from "vue";
import { useStorage } from "@vueuse/core";

export const PRIMARY_COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose"
] as const;

export const NEUTRAL_COLORS = ["slate", "gray", "zinc", "neutral", "stone"] as const;

export function useTheme() {
  const primary = useStorage<string>("ohmymeme_theme_primary", "rose");
  const neutral = useStorage<string>("ohmymeme_theme_neutral", "slate");

  watch([primary, neutral], () => applyTheme(primary.value, neutral.value), { immediate: true });

  return { primary, neutral };
}

function applyTheme(primary: string, neutral: string) {
  const appConfig = useAppConfig();
  const colors = appConfig.ui.colors as Record<string, string>;
  if ((PRIMARY_COLORS as readonly string[]).includes(primary)) {
    colors.primary = primary;
  }
  if ((NEUTRAL_COLORS as readonly string[]).includes(neutral)) {
    colors.neutral = neutral;
  }
}
