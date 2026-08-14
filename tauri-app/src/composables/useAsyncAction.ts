import { ref } from "vue";
import { getErrorMessage } from "../utils/error";

interface AsyncActionOptions {
  success: string
  description?: string
  error?: string
}

export function useAsyncAction() {
  const toast = useToast();
  const pending = ref(false);

  async function run(action: () => Promise<unknown>, options: AsyncActionOptions): Promise<boolean> {
    pending.value = true;
    try {
      await action();
      toast.add({
        title: options.success,
        ...(options.description ? { description: options.description } : {}),
        color: "success"
      });
      return true;
    } catch (error) {
      toast.add({
        title: options.error ?? "操作失败",
        description: getErrorMessage(error),
        color: "error"
      });
      return false;
    } finally {
      pending.value = false;
    }
  }

  return { pending, run };
}
