<script setup lang="ts">
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="设置" :toggle="false" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse class="desktop-sidebar-collapse" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 xl:max-w-4xl">
        <ServerCard />
        <AppearanceCard />
        <BehaviorCard />
        <ShortcutCard />
        <AccountCard />
        <AboutCard />
      </div>
    </template>
  </UDashboardPanel>
</template>
