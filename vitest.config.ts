import path from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve('.');
const srcAppDir = path.resolve(rootDir, 'src/app');
const srcSharedDir = path.resolve(rootDir, 'src/shared');
const testImportsFile = path.resolve(rootDir, 'src/test/nuxt-imports.ts');
const nuxtAppDir = path.resolve(rootDir, 'node_modules/nuxt/dist/app');
const nuxtHeadDir = path.resolve(rootDir, 'node_modules/nuxt/dist/head/runtime/composables');
const vueRouterDir = path.resolve(rootDir, 'node_modules/vue-router');

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: [
            { find: /^#imports$/, replacement: testImportsFile },
            { find: /^#shared$/, replacement: srcSharedDir },
            { find: /^#shared\/(.*)$/, replacement: `${srcSharedDir}/$1` },
            { find: /^~$/, replacement: srcAppDir },
            { find: /^~\/(.*)$/, replacement: `${srcAppDir}/$1` },
            { find: /^@$/, replacement: srcAppDir },
            { find: /^@\/(.*)$/, replacement: `${srcAppDir}/$1` },
            { find: /^~~$/, replacement: rootDir },
            { find: /^~~\/(.*)$/, replacement: `${rootDir}/$1` },
            { find: /^@@$/, replacement: rootDir },
            { find: /^@@\/(.*)$/, replacement: `${rootDir}/$1` },
            { find: /^#app$/, replacement: nuxtAppDir },
            { find: /^#app\/(.*)$/, replacement: `${nuxtAppDir}/$1` },
            { find: /^#unhead\/composables$/, replacement: nuxtHeadDir },
            { find: /^#vue-router$/, replacement: vueRouterDir },
        ],
    },
    test: {
        environment: 'happy-dom',
        include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.vue'],
        exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', 'test-results/**'],
    },
});
