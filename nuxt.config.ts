// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    srcDir: 'src',
    devtools: {enabled: true},

    typescript: {
        typeCheck: true,
    },

    telemetry: false,
    ssr: !!process.env.NUXT_SSR,
    css: ['~/public/css/styles.css'],

    nitro: {
        compressPublicAssets: true,
        prerender: {
            routes: ['/'],
        },
    },

    runtimeConfig: {
        appIcsUrls: process.env.APP_ICS_URLS,
        appCacheTtl: process.env.APP_CACHE_TTL ? parseInt(process.env.APP_CACHE_TTL) : 86400,
        appWikipediaLangEnforce: process.env.APP_WIKIPEDIA_LANG_ENFORCE,
        appWikipediaLang: process.env.APP_WIKIPEDIA_LANG || 'en',
        appWikipediaSections: process.env.APP_WIKIPEDIA_SECTIONS,
    },

    modules: [
        '@vite-pwa/nuxt',
        '@nuxt/test-utils/module',
        '@nuxt/eslint',
    ],
    experimental: {
        payloadExtraction: false,
    },

    pwa: {
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        manifest: {
            'name': 'On This Day',
            'short_name': 'OTD',
            'display': 'standalone',
            'id': './',
            'scope': './',
            'start_url': './',
            'icons': [
                {
                    'src': 'icons/icon-192x192.png',
                    'sizes': '192x192',
                    'type': 'image/png',
                    'purpose': 'maskable any'
                },
                {
                    'src': 'icons/icon-512x512.png',
                    'sizes': '512x512',
                    'type': 'image/png',
                    'purpose': 'maskable any'
                }
            ]
        },
        workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        },
    },
});
