import { computed, reactive, ref, type Ref } from "vue";
import { useServer } from "./useServer";
import { useAuth } from "./useAuth";

type FileStatus = "pending" | "uploading" | "success" | "failed";

interface UploadFile {
  file: File
  status: FileStatus
  reason?: string
  url: string
}

interface UploadBatchResult {
  results: Array<{ name: string, status: "created" | "failed", reason?: string }>
}

const MAX_FILES = 500
const MAX_FILE_SIZE = 20 * 1024 * 1024
const BATCH_SIZE = 20
const MAX_BATCH_BYTES = 100 * 1024 * 1024
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extractXhrError(xhr: XMLHttpRequest): string {
  try {
    const data = JSON.parse(xhr.responseText);
    return data?.message || data?.statusMessage || `请求失败 (${xhr.status})`;
  } catch {
    return `请求失败 (${xhr.status})`;
  }
}

export function useUpload(groupId: Ref<string>, onDone: () => Promise<void>) {
  const toast = useToast();
  const { resolveUrl } = useServer();
  const { sessionToken } = useAuth();

  const files = ref<UploadFile[]>([]);
  const uploading = ref(false);
  const doneCount = ref(0);
  const failedCount = ref(0);
  const submitTotalBytes = ref(0);
  const uploadedBytes = ref(0);

  const uploadableCount = computed(() => files.value.filter(item => item.status !== "success").length);
  const progress = computed(() => {
    if (!submitTotalBytes.value) {
      return 0;
    }
    return Math.min(100, Math.round((uploadedBytes.value / submitTotalBytes.value) * 100));
  });
  const totalBytesText = computed(() => formatBytes(submitTotalBytes.value));
  const uploadedBytesText = computed(() => formatBytes(uploadedBytes.value));

  function addFiles(incoming: File[]) {
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name}（格式不支持）`);
        continue;
      }
      if (file.size === 0) {
        rejected.push(`${file.name}（文件为空）`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}（超过 20MB）`);
        continue;
      }
      if (files.value.length >= MAX_FILES) {
        rejected.push(`（单次最多 ${MAX_FILES} 个文件）`);
        break;
      }
      files.value.push({ file, status: "pending", url: URL.createObjectURL(file) });
    }
    if (rejected.length) {
      toast.add({
        title: "部分文件未添加",
        description: rejected.slice(0, 3).join("、") + (rejected.length > 3 ? " 等" : ""),
        color: "warning"
      });
    }
  }

  function removeFile(index: number) {
    const item = files.value[index];
    if (item) {
      URL.revokeObjectURL(item.url);
    }
    files.value.splice(index, 1);
  }

  function reset() {
    files.value.forEach(item => URL.revokeObjectURL(item.url));
    files.value = [];
    doneCount.value = 0;
    failedCount.value = 0;
    submitTotalBytes.value = 0;
    uploadedBytes.value = 0;
  }

  function uploadBatch(batch: UploadFile[], onProgress: (loaded: number) => void): Promise<UploadBatchResult> {
    return new Promise((resolve, reject) => {
      const attempt = (retried: boolean) => {
        const form = new FormData();
        form.append("groupId", groupId.value);
        batch.forEach(({ file }) => form.append("files", file));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", resolveUrl("/api/memes"));
        if (sessionToken.value) {
          xhr.setRequestHeader("Authorization", `Bearer ${sessionToken.value}`);
        }
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as UploadBatchResult);
            } catch {
              resolve({ results: [] });
            }
          } else if (xhr.status === 0 && !retried) {
            // 网络层失败（连接未建立/被中断）：自动重试一次，避免首次上传偶发失败需手动重传
            setTimeout(() => attempt(true), 400);
          } else {
            reject(new Error(extractXhrError(xhr)));
          }
        };
        xhr.onerror = () => {
          if (!retried) {
            setTimeout(() => attempt(true), 400);
          } else {
            reject(new Error("网络错误，请检查服务器连接"));
          }
        };
        xhr.send(form);
      };
      attempt(false);
    });
  }

  function buildBatches(targets: UploadFile[]): UploadFile[][] {
    const batches: UploadFile[][] = [];
    let current: UploadFile[] = [];
    let currentBytes = 0;
    for (const item of targets) {
      if (current.length >= BATCH_SIZE || (current.length > 0 && currentBytes + item.file.size > MAX_BATCH_BYTES)) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push(item);
      currentBytes += item.file.size;
    }
    if (current.length > 0) {
      batches.push(current);
    }
    return batches;
  }

  async function submit() {
    const targets = files.value.filter(item => item.status !== "success");
    if (!targets.length || uploading.value || !groupId.value) {
      return;
    }

    uploading.value = true;
    doneCount.value = 0;
    failedCount.value = 0;
    uploadedBytes.value = 0;
    submitTotalBytes.value = targets.reduce((sum, item) => sum + item.file.size, 0);
    let completedBytes = 0;

    try {
      for (const batch of buildBatches(targets)) {
        const batchBytes = batch.reduce((sum, item) => sum + item.file.size, 0);
        batch.forEach(item => {
          item.status = "uploading";
        });
        try {
          const result = await uploadBatch(batch, (loaded) => {
            uploadedBytes.value = completedBytes + loaded;
          });
          result.results.forEach((entry, index) => {
            const item = batch[index];
            if (!item) {
              return;
            }
            if (entry.status === "created") {
              item.status = "success";
              doneCount.value++;
            } else {
              item.status = "failed";
              item.reason = entry.reason;
              failedCount.value++;
            }
          });
          const unmatched = batch.length - result.results.length;
          if (unmatched > 0) {
            batch.slice(result.results.length).forEach(item => {
              item.status = "failed";
              item.reason = "服务器未返回结果";
              failedCount.value++;
            });
          }
        } catch (error) {
          batch.forEach(item => {
            item.status = "failed";
            item.reason = error instanceof Error ? error.message : "上传失败";
          });
          failedCount.value += batch.length;
        }
        completedBytes += batchBytes;
      }

      if (failedCount.value === 0) {
        toast.add({ title: "上传成功", description: `已上传 ${doneCount.value} 个表情`, color: "success" });
      } else {
        toast.add({ title: "上传完成", description: `成功 ${doneCount.value}，失败 ${failedCount.value} 个`, color: "warning" });
      }
      await onDone();
    } finally {
      uploading.value = false;
    }
  }

  function retryFailed() {
    files.value.forEach(item => {
      if (item.status === "failed") {
        item.status = "pending";
        item.reason = undefined;
      }
    });
    submit();
  }

  return reactive({
    files,
    uploading,
    doneCount,
    failedCount,
    uploadableCount,
    progress,
    totalBytesText,
    uploadedBytesText,
    addFiles,
    removeFile,
    reset,
    submit,
    retryFailed
  });
}
