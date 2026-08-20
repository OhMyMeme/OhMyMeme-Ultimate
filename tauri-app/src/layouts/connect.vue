<script setup lang="ts">
import { useRouteMotion } from "../composables/useRouteMotion";

const { active: routeMotionActive } = useRouteMotion();
</script>

<template>
  <div class="layout-motion flex min-h-screen items-center justify-center bg-elevated px-4">
    <RouterView :class="{ 'page-motion': routeMotionActive }" />
  </div>
</template>