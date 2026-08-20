import { ref } from "vue";
import { createSharedComposable } from "@vueuse/core";
import type { MemeGroup } from "../types";
import { useApi } from "./useApi";

const _useMemes = () => {
  const api = useApi();

  const groups = ref<MemeGroup[]>([]);
  const loading = ref(false);
  const revision = ref(0);

  async function refresh() {
    loading.value = true;
    try {
      groups.value = await api.getGroups();
    } catch (error) {
      console.error("[memes] 加载分组失败", error);
    } finally {
      loading.value = false;
    }
  }

  function bumpRevision() {
    revision.value++;
  }

  function groupById(id: string) {
    return groups.value.find(group => group.id === id);
  }

  /** 主操作成功后附带刷新分组；刷新失败不影响主操作的成功结果（revision 照常触发列表重载） */
  async function refreshAfter(action: () => Promise<unknown>) {
    const result = await action();
    revision.value++;
    try {
      await refresh();
    } catch (error) {
      console.error("[memes] 刷新分组失败", error);
    }
    return result;
  }

  function createGroup(name: string) {
    return refreshAfter(() => api.createGroup(name));
  }

  /** 按名称取得分组 id，不存在则创建（文件夹导入用）；重名(409)时以服务端现有分组为准 */
  async function ensureGroup(name: string): Promise<string> {
    const existing = groups.value.find(group => group.name === name && !group.isFavorites && !group.isRecent);
    if (existing) {
      return existing.id;
    }
    try {
      const created = await api.createGroup(name) as MemeGroup;
      revision.value++;
      await refresh();
      return created.id;
    } catch (error) {
      await refresh();
      const found = groups.value.find(group => group.name === name && !group.isFavorites && !group.isRecent);
      if (found) {
        return found.id;
      }
      throw error;
    }
  }

  function renameGroup(id: string, name: string) {
    return refreshAfter(() => api.renameGroup(id, name));
  }

  function deleteGroup(id: string) {
    return refreshAfter(() => api.deleteGroup(id));
  }

  function updateMeme(id: string, data: { name?: string, groupId?: string, favorite?: boolean, tags?: string[] }) {
    return refreshAfter(() => api.updateMeme(id, data));
  }

  function toggleFavorite(id: string, favorite: boolean) {
    return refreshAfter(() => api.updateMeme(id, { favorite }));
  }

  function deleteMeme(id: string) {
    return refreshAfter(() => api.deleteMeme(id));
  }

  function batchMemes(ids: string[], action: "move" | "delete", groupId?: string) {
    return refreshAfter(() => api.batchMemes(ids, action, groupId));
  }

  return {
    groups,
    loading,
    revision,
    refresh,
    bumpRevision,
    groupById,
    createGroup,
    ensureGroup,
    renameGroup,
    deleteGroup,
    updateMeme,
    toggleFavorite,
    deleteMeme,
    batchMemes
  };
};

export const useMemes = createSharedComposable(_useMemes);
