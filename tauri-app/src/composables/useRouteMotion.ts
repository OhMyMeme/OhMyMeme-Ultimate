import { nextTick, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

export function useRouteMotion() {
  const route = useRoute();
  const active = ref(false);
  let frame = 0;

  function play() {
    active.value = false;
    if (typeof window === "undefined") {
      active.value = true;
      return;
    }
    cancelAnimationFrame(frame);
    nextTick(() => {
      frame = requestAnimationFrame(() => {
        active.value = true;
      });
    });
  }

  watch(() => route.fullPath, play, { flush: "post", immediate: true });

  onUnmounted(() => {
    cancelAnimationFrame(frame);
  });

  return { active };
}
