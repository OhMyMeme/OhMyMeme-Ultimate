import type { Meme, MemeGroup, MemeListResponse, Overview, Tag } from "../types";
import { useServer } from "./useServer";
import { useAuth } from "./useAuth";

export interface BatchResult {
  count: number
}

export function useApi() {
  const { resolveUrl } = useServer();
  const { sessionToken } = useAuth();

  function authHeaders(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) {
      headers["Content-Type"] = "application/json";
    }
    if (sessionToken.value) {
      headers.Authorization = `Bearer ${sessionToken.value}`;
    }
    return headers;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const isJson = typeof init?.body === "string";
    let res: Response;
    try {
      res = await fetch(resolveUrl(path), {
        headers: authHeaders(isJson),
        signal: AbortSignal.timeout(15000),
        ...init
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("请求超时，请检查服务器连接");
      }
      throw error;
    }

    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try {
        const data = await res.json();
        message = data?.message || data?.statusMessage || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }

  return {
    getGroups: () => request<MemeGroup[]>("/api/groups"),
    createGroup: (name: string) => request<MemeGroup>("/api/groups", { method: "POST", body: JSON.stringify({ name }) }),
    renameGroup: (id: string, name: string) => request<MemeGroup>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    deleteGroup: (id: string) => request<unknown>(`/api/groups/${id}`, { method: "DELETE" }),
    getMemes: (groupId?: string, limit = 48, offset = 0, opts: { tags?: string[], q?: string } = {}) => {
      const params = new URLSearchParams();
      if (groupId) params.set("group", groupId);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (opts.tags?.length) params.set("tags", opts.tags.join(","));
      if (opts.q) params.set("q", opts.q);
      return request<MemeListResponse>(`/api/memes?${params.toString()}`);
    },
    getTags: () => request<Tag[]>("/api/tags"),
    updateMeme: (id: string, data: { name?: string, groupId?: string, favorite?: boolean, tags?: string[] }) => request<Meme>(`/api/memes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    markUsed: (id: string) => request<Meme>(`/api/memes/${id}/use`, { method: "POST" }),
    deleteMeme: (id: string) => request<unknown>(`/api/memes/${id}`, { method: "DELETE" }),
    batchMemes: (ids: string[], action: "move" | "delete", groupId?: string) => request<BatchResult>("/api/memes/batch", { method: "POST", body: JSON.stringify({ ids, action, groupId }) }),
    /** 拖动排序：把 id 移动到 beforeId 之前；beforeId 省略表示移到末尾 */
    reorderMeme: (id: string, beforeId?: string) => request<{ ok: boolean }>("/api/memes/reorder", { method: "POST", body: JSON.stringify({ id, beforeId: beforeId ?? null }) }),
    getOverview: () => request<Overview>("/api/overview")
  };
}