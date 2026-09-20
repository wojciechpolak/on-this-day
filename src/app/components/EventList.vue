<!--
/**
 * components/EventList.vue
 *
 * On This Day (C) 2026 Wojciech Polak
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
import { computed } from 'vue';
import { parseInputText } from '#shared/helpers';
import { useLanguage } from '~/composables/useLanguage';
import { useCurrentDate } from '~/composables/useCurrentDate';
import type { IcsEvent } from '#shared/ics-parser';

const props = defineProps<{
    /** DOM id of the list container. */
    containerId: string;
    /** Accessible name of the list container. */
    label: string;
    /** Namespace for the transition and event keys. */
    keyPrefix: string;
    /** Key that restarts the stack animation whenever the collection changes. */
    motionKey: string;
    loading: boolean;
    /** Heading shown instead of the list when the source failed. */
    errorTitle: string;
    /** Error text to show, or `null` when the source is healthy. */
    errorMessage: string | null;
    /** Whether to show the "nothing found" placeholder. */
    showEmpty: boolean;
    events: IcsEvent[];
}>();

const userLang = computed<string>(() => {
    return useLanguage().value || 'en';
});

const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
};

function formatDate(date: Date): string {
    return date.toLocaleDateString(userLang.value, dateOptions);
}

function getEventKey(prefix: string, event: IcsEvent) {
    const start = event.DTSTART?.toISOString() || 'no-start';
    const end = event.DTEND?.toISOString() || 'no-end';
    return `${prefix}-${start}-${end}-${event.SUMMARY || ''}`;
}

function getRelativeTime(eventDate: Date) {
    const today: Date = useCurrentDate();
    const timeDifference: number = eventDate.getTime() - today.getTime();
    const secondsDifference = Math.round(timeDifference / 1000);
    const rtf = new Intl.RelativeTimeFormat(userLang.value, { numeric: 'auto' });
    const thresholds = [
        { unit: 'second', threshold: 60 },
        { unit: 'minute', threshold: 60 },
        { unit: 'hour', threshold: 24 },
        { unit: 'day', threshold: 30 },
        { unit: 'month', threshold: 12 },
        { unit: 'year', threshold: Number.POSITIVE_INFINITY },
    ];
    function _formatTimestamp(timestamp: number) {
        let remainingTime = timestamp;
        for (const { unit, threshold } of thresholds) {
            if (Math.abs(remainingTime) < threshold) {
                const value = Math.round(remainingTime);
                return rtf.format(Math.round(value), unit as Intl.RelativeTimeFormatUnit);
            }
            remainingTime /= threshold;
        }
        return rtf.format(Math.round(remainingTime), 'year');
    }
    return _formatTimestamp(secondsDifference);
}

/**
 * Tells whether an ICS range spans whole days ending at midnight of the next day.
 */
function isAllDayRange(startDate: Date, endDate: Date): boolean {
    if (
        endDate.getUTCHours() !== 0 ||
        endDate.getUTCMinutes() !== 0 ||
        endDate.getUTCSeconds() !== 0
    ) {
        return false;
    }
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setUTCDate(endDate.getUTCDate() - 1);
    return startDate.toDateString() === adjustedEndDate.toDateString();
}

function formatEventDateRange(startDate: Date, endDate: Date): string {
    if (!startDate) {
        return '';
    }
    if (!endDate) {
        return formatDate(startDate);
    }
    // All-day or single-day event
    if (isAllDayRange(startDate, endDate) || startDate.toDateString() === endDate.toDateString()) {
        return formatDate(startDate);
    }
    // Multi-day
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function renderEventHtml(event: IcsEvent): string {
    const relDate = getRelativeTime(event.DTSTART || event.DTEND);
    const summary = parseInputText(event.SUMMARY || '');
    const description = event['X-ALT-DESC'] || parseInputText(event.DESCRIPTION || '');
    const dateRange = formatEventDateRange(event.DTSTART, event.DTEND || event.DTSTART);

    return `
    <h2>
      ${relDate ? `<span class="rel-date">${relDate}</span>` : ''}
      <span class="title">${summary}</span>
    </h2>
    <p class="description">${description}</p>
    <footer><time>${dateRange}</time></footer>
  `;
}

const loadingKey = computed(() => `${props.keyPrefix}-loading`);
const errorKey = computed(() => `${props.keyPrefix}-error`);
</script>

<template>
    <div :id="containerId" class="event-list" aria-live="polite" :aria-label="label">
        <Transition name="event-stack-fade" mode="out-in">
            <div v-if="loading" :key="loadingKey" class="loading">
                <span class="loading-text">Loading</span>
                <span class="loading-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </span>
            </div>
            <div v-else-if="errorMessage" :key="errorKey" class="source-error" role="alert">
                <strong>{{ errorTitle }}</strong>
                <span>{{ errorMessage }}</span>
            </div>
            <div v-else :key="motionKey" class="event-stack">
                <div v-if="showEmpty" class="no-events-message">
                    Nothing found. Looks like today is a quiet day in history.
                </div>
                <!-- oxlint-disable vue/no-v-html -->
                <article
                    v-for="(event, idx) in events"
                    :key="getEventKey(keyPrefix, event)"
                    :style="{ '--stagger-index': idx }"
                    class="event"
                    v-html="renderEventHtml(event)"
                />
                <!-- oxlint-enable -->
            </div>
        </Transition>
    </div>
</template>
