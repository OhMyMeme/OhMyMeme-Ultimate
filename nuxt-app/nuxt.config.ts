export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-mongoose',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    accessToken: '',
    allowedOrigins: '',
    webEnabled: false
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    experimental: {
      websocket: true
    },
    externals: {
      external: ['sharp']
    },
    storage: {
      memes: {
        driver: 'fs',
        base: process.env.NUXT_STORAGE_LOCAL_DIR || '.data/uploads/memes'
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    clientBundle: {
      scan: {
        globInclude: ['**/*.{vue,jsx,tsx,ts,md,mdc,mdx,yml,yaml}']
      }
    }
  }
})
