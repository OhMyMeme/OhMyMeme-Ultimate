export function usePlatform() {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  const isWindowsTauri = isTauri && isWindows;

  return { isTauri, isWindowsTauri };
}