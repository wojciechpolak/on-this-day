<!--
/**
 * app.vue
 *
 * On This Day (C) 2025 Wojciech Polak
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
-->

<script setup lang="ts">
useHead({
    htmlAttrs: {
        lang: 'en'
    },
    title: 'On This Day',
    meta: [
        {
            name: 'description',
            content: 'See events from your calendars that occurred on this day, ' +
                'during this week, or throughout this month in previous years.'
        },
        {
            name: 'theme-color',
            content: '#f0f0f0',
            media: '(prefers-color-scheme: light)',
        },
        {
            name: 'theme-color',
            content: '#121212',
            media: '(prefers-color-scheme: dark)',
        },
    ],
    link: [
        {
            rel: 'icon',
            href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22>' +
                '<text y=%22.9em%22 font-size=%2290%22>🕰️</text></svg>'
        },
    ],
});
</script>

<template>
    <NuxtPwaAssets />
    <NuxtLayout>
        <NuxtPage />
    </NuxtLayout>
</template>
