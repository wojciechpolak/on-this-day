<!--
/**
 * error.vue
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
import type { NuxtError } from '#app';

const response = useResponseHeader('Status');

const props = defineProps<{ error?: NuxtError }>();

if (import.meta.server) {
    response.value = props.error?.statusCode;
}
</script>

<template>
    <div id="app">
        <div class="page-shell">
            <section class="hero">
                <div class="hero-copy">
                    <p class="eyebrow">Page unavailable</p>
                    <h1>{{ props?.error?.statusCode || 'Error' }}</h1>
                    <p class="hero-description">
                        {{ props?.error?.message || 'Something interrupted the timeline.' }}
                    </p>
                </div>
            </section>

            <section class="tabs-container">
                <div class="tab-content">
                    <p class="section-label">Recovery</p>
                    <h2 class="section-title">Return to the archive and try again.</h2>
                    <p class="section-note">
                        <NuxtLink to="/">Go back home</NuxtLink>
                    </p>
                </div>
            </section>
        </div>
    </div>
</template>
