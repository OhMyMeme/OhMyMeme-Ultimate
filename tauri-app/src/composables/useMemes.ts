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
    } finally {
      loading.value = false;
    }
  }

  function groupById(id: string) {
    return groups.value.find(group => group.id === id);
  }

  async function createGroup(name: string) {
    const group = await api.createGroup(name);
    await refresh();
    revision.value++;
    return group;
  }

  async function renameGroup(id: string, name: string) {
    const group = await api.renameGroup(id, name);
    await refresh();
    revision.value++;
    return group;
  }

  async function deleteGroup(id: string) {
    await api.deleteGroup(id);
    await refresh();
    revision.value++;
  }

  async function updateMeme(id: string, data: { name?: string, groupId?: string }) {
    const meme = await api.updateMeme(id, data);
    await refresh();
    revision.value++;
    return meme;
  }

  async function deleteMeme(id: string) {
    await api.deleteMeme(id);
    await refresh();
    revision.value++;
  }

  async function batchMemes(ids: string[], action: "move" | "delete", groupId?: string) {
    const result = await api.batchMemes(ids, action, groupId);
    await refresh();
    revision.value++;
    return result;
  }

  async function upload(groupId: string, files: File[]) {
    const memes = await api.uploadMemes(groupId, files);
    await refresh();
    revision.value++;
    return memes;
  }

  return {
    groups,
    loading,
    revision,
    refresh,
    groupById,
    createGroup,
    renameGroup,
    deleteGroup,
    updateMeme,
    deleteMeme,
    batchMemes,
    upload
  };
};

export const useMemes = createSharedComposable(_useMemes);
