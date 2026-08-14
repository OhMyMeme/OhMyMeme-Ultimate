<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="总览" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarToggle />
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UploadMemeButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeStats />
    </template>
  </UDashboardPanel>
</template>
