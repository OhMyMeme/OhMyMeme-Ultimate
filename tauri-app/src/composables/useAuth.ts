import { computed } from "vue";
import { createSharedComposable, useStorage } from "@vueuse/core";
import { useServer } from "./useServer";

const _useAuth = () => {
  const { resolveUrl } = useServer();

  const sessionToken = useStorage<string>("ohmymeme_session_token", "");

  const isAuthenticated = computed(() => Boolean(sessionToken.value));

  async function login(accessToken: string): Promise<void> {
    const res = await fetch(resolveUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken })
    });
    if (!res.ok) {
      let message = `登录失败 (${res.status})`;
      try {
        const data = await res.json();
        message = data?.statusMessage || data?.message || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    const data = await res.json();
    if (!data?.token) {
      throw new Error("登录失败：服务器未返回会话令牌");
    }
    sessionToken.value = data.token;
  }

  function logout() {
    sessionToken.value = "";
  }

  function authorizeUrl(url: string): string {
    if (!sessionToken.value) {
      return url;
    }
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}token=${encodeURIComponent(sessionToken.value)}`;
  }

  return { sessionToken, isAuthenticated, login, logout, authorizeUrl };
};

export const useAuth = createSharedComposable(_useAuth);
