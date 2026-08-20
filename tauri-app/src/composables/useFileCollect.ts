import { ACCEPTED_TYPES, MAX_FILE_SIZE, MAX_FILES, MAX_IMAGE_EDGE } from "./useUpload";

export interface CollectedFile {
  file: File
  /** 相对目录名（文件夹导入时为其所在文件夹名），用于按文件夹自动建分组 */
  folder?: string
}

export interface CollectResult {
  files: CollectedFile[]
  rejected: string[]
}

function isAcceptedName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function folderOf(relativePath: string): string | undefined {
  const parts = relativePath.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts[parts.length - 1] : undefined;
}

/** 读取图片像素尺寸（仅解码头部所需的最小工作量由浏览器内部完成） */
export function readImageSize(file: File): Promise<{ width: number, height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** 客户端预校验：格式 / 空文件 / 体积 / 分辨率（与服务端 2560px 上限一致），逐项给出拒绝原因 */
export async function screenFiles(incoming: CollectedFile[], alreadyCount = 0): Promise<CollectResult> {
  const files: CollectedFile[] = [];
  const rejected: string[] = [];

  for (const item of incoming) {
    const { file } = item;
    if (alreadyCount + files.length >= MAX_FILES) {
      rejected.push(`（单次最多 ${MAX_FILES} 个文件）`);
      break;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !isAcceptedName(file.name)) {
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
    const size = await readImageSize(file);
    if (!size) {
      rejected.push(`${file.name}（图片损坏或无法解析）`);
      continue;
    }
    if (Math.max(size.width, size.height) > MAX_IMAGE_EDGE) {
      rejected.push(`${file.name}（${size.width}×${size.height} 超过 ${MAX_IMAGE_EDGE}px）`);
      continue;
    }
    files.push(item);
  }

  return { files, rejected };
}

/** 递归展开 DataTransfer 里的目录项（拖放文件夹时 webkitGetAsEntry 提供目录树） */
function readEntry(entry: FileSystemEntry, trail: string[], out: CollectedFile[]): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({ file, folder: trail.length ? trail[trail.length - 1] : undefined });
          resolve();
        },
        () => resolve()
      );
    });
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const trailNext = [...trail, entry.name];
  return new Promise((resolve) => {
    const batch: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(
        async (entries) => {
          if (!entries.length) {
            for (const child of batch) {
              await readEntry(child, trailNext, out);
            }
            resolve();
            return;
          }
          batch.push(...entries);
          readBatch();
        },
        () => resolve()
      );
    };
    readBatch();
  });
}

/** 从拖放事件收集文件：支持多文件与文件夹（含子目录） */
export async function collectFromDataTransfer(transfer: DataTransfer | null): Promise<CollectedFile[]> {
  if (!transfer) {
    return [];
  }

  const items = Array.from(transfer.items || []).filter(item => item.kind === "file");
  const entries = items
    .map(item => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length) {
    const out: CollectedFile[] = [];
    for (const entry of entries) {
      await readEntry(entry, [], out);
    }
    return out;
  }

  return Array.from(transfer.files || []).map(file => ({ file }));
}

/** 从 <input webkitdirectory> 收集文件：用 webkitRelativePath 还原所属文件夹 */
export function collectFromInput(input: HTMLInputElement): CollectedFile[] {
  return Array.from(input.files || []).map(file => ({
    file,
    folder: folderOf((file as File & { webkitRelativePath?: string }).webkitRelativePath || "")
  }));
}
