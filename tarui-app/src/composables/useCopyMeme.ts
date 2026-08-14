import { invoke } from "@tauri-apps/api/core";
import type { Meme } from "../types";
import { getErrorMessage } from "../utils/error";
import { useServer } from "./useServer";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function extensionOf(mimeType: string): string {
  const map: Record<string, string> = {
    "image/gif": "gif",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  };
  return map[mimeType] ?? "png";
}

export function useCopyMeme() {
  const toast = useToast();
  const { resolveUrl } = useServer();

  async function copy(meme: Meme) {
    const url = resolveUrl(meme.url);
    console.log(`[copy] 开始复制: ${meme.name} (${meme.mimeType}) url=${url} isTauri=${isTauri}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`fetch 失败: ${res.status} ${res.statusText}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      console.log(`[copy] 已拉取 ${bytes.length} 字节`);

      if (isTauri) {
        const extension = extensionOf(meme.mimeType);
        console.log(`[copy] 走原生剪贴板 CF_HDROP (扩展名 .${extension})`);
        await invoke("copy_file_to_clipboard", { bytes: Array.from(bytes), extension });
        console.log("[copy] CF_HDROP 写入成功");
        toast.add({
          title: "已复制",
          description: meme.mimeType === "image/gif" ? "GIF 已复制，粘贴到聊天保留动画" : undefined,
          color: "success"
        });
        return;
      }

      const blob = new Blob([bytes], { type: meme.mimeType });
      try {
        await navigator.clipboard.write([new ClipboardItem({ [meme.mimeType]: blob })]);
      } catch {
        const png = await blobToPng(blob);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      }
      toast.add({ title: "已复制", color: "success" });
    } catch (error) {
      console.error("[copy] 复制失败", error);
      toast.add({ title: "复制失败", description: getErrorMessage(error), color: "error" });
    }
  }

  return { copy };
}

function blobToPng(source: Blob): Promise<Blob> {
  const url = URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas 2d 上下文不可用"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("canvas toBlob 失败"));
        }
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}
