<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useSettings } from "../../composables/useSettings";
import { useGlobalShortcut } from "../../composables/useGlobalShortcut";

const DEFAULT_SHORTCUT = "ctrl+alt+n";

const toast = useToast();
const { shortcut } = useSettings();
const { apply } = useGlobalShortcut();

const recording = ref(false);

const labels: Record<string, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  super: "Super",
  space: "Space",
  enter: "Enter",
  escape: "Esc",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right"
};

function formatDisplay(value: string) {
  return value.split("+").map((part) => {
    if (labels[part]) {
      return labels[part];
    }
    if (/^f\d{1,2}$/.test(part)) {
      return part.toUpperCase();
    }
    return part.length === 1 ? part.toUpperCase() : part;
  }).join(" + ");
}

const display = computed(() => formatDisplay(shortcut.value));
const isDefault = computed(() => shortcut.value === DEFAULT_SHORTCUT);

const modifierKeys = new Set(["Control", "Alt", "Shift", "Meta"]);

const namedKeys: Record<string, string> = {
  Space: "space",
  Enter: "enter",
  Tab: "tab",
  Backspace: "backspace",
  Delete: "delete",
  Escape: "escape",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right"
};

function parseKey(event: KeyboardEvent): string | null {
  const code = event.code;
  if (code.startsWith("Key")) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }
  if (/^Numpad\d$/.test(code)) {
    return code.slice(6);
  }
  if (/^F\d{1,2}$/.test(code)) {
    return code.toLowerCase();
  }
  return namedKeys[code] ?? null;
}

function handleKeydown(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    stopRecording();
    return;
  }

  if (modifierKeys.has(event.key)) {
    return;
  }

  const key = parseKey(event);
  if (!key) {
    return;
  }

  if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    stopRecording();
    toast.add({
      title: "需要修饰键",
      description: "请同时按住 Ctrl / Alt / Shift / Super 等修饰键",
      color: "warning"
    });
    return;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  if (event.metaKey) parts.push("super");
  parts.push(key);

  stopRecording();
  saveShortcut(parts.join("+"));
}

async function saveShortcut(value: string) {
  const previous = shortcut.value;
  shortcut.value = value;
  const error = await apply(value);
  if (error) {
    shortcut.value = previous;
    toast.add({ title: "快捷键设置失败", description: error, color: "error" });
    return;
  }
  toast.add({ title: "快捷键已更新", description: formatDisplay(value), color: "success" });
}

function startRecording() {
  recording.value = true;
  window.addEventListener("keydown", handleKeydown, { capture: true });
}

function stopRecording() {
  recording.value = false;
  window.removeEventListener("keydown", handleKeydown, { capture: true });
}

function toggleRecording() {
  if (recording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

function resetToDefault() {
  saveShortcut(DEFAULT_SHORTCUT);
}

onBeforeUnmount(stopRecording);
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-keyboard" class="size-4 text-dimmed" />
        <h3 class="text-sm font-semibold text-highlighted">
          全局快捷键
        </h3>
      </div>
    </template>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-highlighted">
          显示 / 隐藏主窗口
        </p>
        <p class="text-xs text-muted">
          打开窗口时自动切入收藏分组，点击录制按下新的组合键（Esc 取消）
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :label="recording ? '按下新组合键…' : display"
          :icon="recording ? 'i-lucide-circle-dot' : 'i-lucide-keyboard'"
          :color="recording ? 'primary' : 'neutral'"
          :variant="recording ? 'solid' : 'outline'"
          @click="toggleRecording"
        />
        <UButton
          v-if="!isDefault"
          label="恢复默认"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          @click="resetToDefault"
        />
      </div>
    </div>
  </UCard>
</template>
