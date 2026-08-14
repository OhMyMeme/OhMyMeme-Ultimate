import type { Meme, MemeGroup, MemeListResponse, Overview } from "../types";
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
    const res = await fetch(resolveUrl(path), {
      headers: authHeaders(isJson),
      ...init
    });

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
    getMemes: (groupId?: string, limit = 48, offset = 0) => {
      const params = new URLSearchParams();
      if (groupId) params.set("group", groupId);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return request<MemeListResponse>(`/api/memes?${params.toString()}`);
    },
    updateMeme: (id: string, data: { name?: string, groupId?: string }) => request<Meme>(`/api/memes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteMeme: (id: string) => request<unknown>(`/api/memes/${id}`, { method: "DELETE" }),
    batchMemes: (ids: string[], action: "move" | "delete", groupId?: string) => request<BatchResult>("/api/memes/batch", { method: "POST", body: JSON.stringify({ ids, action, groupId }) }),
    uploadMemes: async (groupId: string, files: File[]) => {
      const form = new FormData();
      form.append("groupId", groupId);
      files.forEach(file => form.append("files", file));
      const res = await fetch(resolveUrl("/api/memes"), { method: "POST", headers: authHeaders(false), body: form });
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
      return res.json() as Promise<Meme[]>;
    },
    getOverview: () => request<Overview>("/api/overview")
  };
}