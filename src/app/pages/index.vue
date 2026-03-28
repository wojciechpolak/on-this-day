<!--
/**
 * pages/index.vue
 *
 * On This Day (C) 2024-2025 Wojciech Polak
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
import { ref, computed, watch } from 'vue';
import { parseInputText } from '#shared/helpers';
import { useLanguage } from '~/composables/useLanguage';
import { useCurrentDate } from '~/composables/useCurrentDate';
import type { IcsEvent } from '#shared/ics-parser';

const selectedTab = ref<'tab-personal' | 'tab-history'>('tab-personal');
const shouldShowHistoryTab = true;

const STORAGE_KEY_VIEW_MODE = 'otdViewMode';
const viewMode = useCookie<'day' | 'week' | 'month' | 'dayOfMonth'>(STORAGE_KEY_VIEW_MODE, {
    default: () => 'day',
    maxAge: 86400 * 365,
});

const selectedDate = ref(useCurrentDate());

const personalEvents = ref<IcsEvent[]>([]);
const historyEvents = ref<IcsEvent[]>([]);

// Filter personal events according to the viewMode
const filteredPersonalEvents = ref<IcsEvent[]>([]);

const userLang = computed<string>(() => {
    return useLanguage().value || 'en';
});

// Title & date subtitle
const titleText = ref('On This Day...');
const dateSubtitle = computed(() => {
    const dateOpts: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    return `${selectedDate.value.toLocaleDateString(userLang.value, dateOpts)}`;
});

const showLoading = ref(false);
let loadingTimer: ReturnType<typeof setTimeout> | null = null;

const activeCollectionCount = computed(() => {
    return selectedTab.value === 'tab-history'
        ? historyEvents.value.length
        : filteredPersonalEvents.value.length;
});

const personalMotionContext = computed(() => {
    return `${viewMode.value}-${isoDate.value}-${filteredPersonalEvents.value.length}`;
});

const historyMotionContext = computed(() => {
    return `${isoDate.value}-${historyEvents.value.length}`;
});

/**
 * Function to convert ISO date strings to Date objects
 */
function dateReviver(_key: string, value: unknown): string | unknown | Date {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    if (typeof value === 'string' && isoDateRegex.test(value)) {
        return new Date(value);
    }
    return value;
}

// --------------------------------------------
// Fetch ICS for personal events (SSR + Client)
// --------------------------------------------

const {
    data: icsData,
    status: icsStatus,
    error: icsError,
} = await useLazyAsyncData(
    'personal-ics',
    () => {
        return $fetch<IcsEvent[]>('/api/fetch-ics', {
            responseType: 'text',
            parseResponse: (rawText: string) => {
                return JSON.parse(rawText, dateReviver);
            },
        });
    },
    {
        immediate: true,
    },
);

// Whenever pendingIcs changes, manage the delay
watch(
    () => icsStatus.value,
    (status) => {
        if (status === 'pending') {
            loadingTimer = setTimeout(() => {
                showLoading.value = true;
            }, 200);
        } else {
            if (loadingTimer) {
                clearTimeout(loadingTimer);
            }
            showLoading.value = false;
        }
    },
    { immediate: true },
);

// Parse ICS text -> personalEvents
watch(
    () => icsData.value,
    (val) => {
        if (!val) {
            personalEvents.value = [];
            return;
        }
        personalEvents.value = val;
        filteredPersonalEvents.value = filterPersonalEvents(personalEvents.value);
    },
    { immediate: true },
);

type CustomError = Error & { data: { message: string } };

const getIcsErrorMessage = computed(() => {
    const err = icsError.value as CustomError;
    return err.data?.message || err.message || 'Connection Error';
});

// ------------------------------
// Fetch ICS for Wikipedia events
// ------------------------------

const isoDate = computed(() => selectedDate.value.toISOString().slice(0, 10));

const {
    data: wikiData,
    status: wikiStatus,
    error: wikiError,
    refresh: refreshWiki,
} = await useLazyAsyncData(
    'wiki-ics',
    () => {
        const lang = userLang.value.slice(0, 2);
        return $fetch<IcsEvent[]>(`/api/fetch-wikipedia?date=${isoDate.value}&lang=${lang}`, {
            responseType: 'text',
            parseResponse: (rawText: string) => {
                return JSON.parse(rawText, dateReviver);
            },
        });
    },
    {
        immediate: false,
    },
);

// ---------
// WATCHERS
//----------

watch(
    () => wikiData.value,
    (val) => {
        if (!val) {
            historyEvents.value = [];
            return;
        }
        historyEvents.value = val;
    },
    { immediate: true },
);

const getWikiErrorMessage = computed(() => {
    const err = wikiError.value as CustomError;
    return err.data?.message || err.message || 'Connection Error';
});

// Re-fetch Wikipedia data when the user changes the date:
watch(selectedDate, async () => {
    if (isHistoryVisible()) {
        await refreshWiki();
    }
});

// Track the view mode (day/week/month/dayOfMonth)
watch(viewMode, (newVal) => {
    setTitle(newVal);
    filteredPersonalEvents.value = filterPersonalEvents(personalEvents.value);
});

// Choose a title based on the current view mode
function setTitle(mode: string) {
    switch (mode) {
        case 'week':
            titleText.value = 'On This Week...';
            break;
        case 'month':
            titleText.value = 'On This Month...';
            break;
        case 'dayOfMonth':
            titleText.value = 'On This Day of the Month...';
            break;
        default:
            titleText.value = 'On This Day...';
    }
}

function filterPersonalEvents(events: IcsEvent[]): IcsEvent[] {
    if (!events.length) {
        return [];
    }

    const day = selectedDate.value.getUTCDate();
    const month = selectedDate.value.getUTCMonth();
    const year = selectedDate.value.getUTCFullYear();

    return events.filter((event) => {
        const eventDate = event.DTSTART || event.DTEND;
        if (!eventDate) {
            return false;
        }
        switch (viewMode.value) {
            case 'week':
                return isEventThisWeek(eventDate, selectedDate.value, year);
            case 'month':
                return isEventThisMonth(eventDate, month, year);
            case 'dayOfMonth':
                return eventDate.getUTCDate() === day;
            default: // 'day'
                // on this day, ignoring current year
                return (
                    eventDate.getUTCDate() === day &&
                    eventDate.getUTCMonth() === month &&
                    eventDate.getUTCFullYear() !== year
                );
        }
    });
}

function isEventThisMonth(eventDate: Date, month: number, year: number) {
    return eventDate.getUTCMonth() === month && eventDate.getUTCFullYear() !== year;
}

function isEventThisWeek(eventDate: Date, currentDate: Date, year: number) {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setUTCDate(currentDate.getUTCDate() - currentDate.getUTCDay());
    startOfWeek.setUTCFullYear(eventDate.getUTCFullYear());
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);
    endOfWeek.setUTCHours(23, 59, 59);

    return (
        eventDate >= startOfWeek && eventDate <= endOfWeek && eventDate.getUTCFullYear() !== year
    );
}

// Tab switching logic
function selectTab(tab: 'tab-personal' | 'tab-history') {
    selectedTab.value = tab;
    if (tab === 'tab-history') {
        // Optionally fetch or refresh Wikipedia events if needed
        // e.g. if it's empty or the date changed
        if (!historyEvents.value.length) {
            refreshWiki(); // triggers SSR fetch again
        }
        // Title for history is typically 'On This Day...'
        titleText.value = 'On This Day...';
    } else {
        setTitle(viewMode.value);
    }
}

function isHistoryVisible() {
    return selectedTab.value === 'tab-history';
}

// Date change handlers
function handleDateChange(direction: number) {
    selectedDate.value = new Date(+selectedDate.value + direction * 86400000);
    filteredPersonalEvents.value = filterPersonalEvents(personalEvents.value);
    // If the user is on the History tab, refresh so we load the new date's events
    if (isHistoryVisible()) {
        refreshWiki();
    }
}

function resetDate() {
    selectedDate.value = useCurrentDate();
    filteredPersonalEvents.value = filterPersonalEvents(personalEvents.value);
    if (isHistoryVisible()) {
        refreshWiki();
    }
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

function formatEventDateRange(startDate: Date, endDate: Date): string {
    if (!startDate) {
        return '';
    }
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    // If ICS indicates all-day event (end is midnight next day):
    if (
        endDate &&
        endDate.getUTCHours() === 0 &&
        endDate.getUTCMinutes() === 0 &&
        endDate.getUTCSeconds() === 0
    ) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setUTCDate(endDate.getUTCDate() - 1);
        if (startDate.toDateString() === adjustedEndDate.toDateString()) {
            return startDate.toLocaleDateString(userLang.value, dateOptions);
        }
    }

    // Single-day event
    if (endDate && startDate.toDateString() === endDate.toDateString()) {
        return startDate.toLocaleDateString(userLang.value, dateOptions);
    }
    // Multi-day
    if (endDate) {
        return `${startDate.toLocaleDateString(userLang.value, dateOptions)} – ${endDate.toLocaleDateString(
            userLang.value,
            dateOptions,
        )}`;
    }
    return startDate.toLocaleDateString(userLang.value, dateOptions);
}
</script>

<template>
    <div id="app">
        <div class="page-shell">
            <header class="hero">
                <div class="hero-heading">
                    <h1 aria-live="polite">{{ titleText }}</h1>
                </div>

                <div class="hero-facts" aria-label="Current view summary">
                    <article class="fact-card">
                        <strong>{{ activeCollectionCount }} entries</strong>
                    </article>
                </div>

                <div class="hero-toolbar">
                    <nav class="date" aria-label="Selected date controls">
                        <button
                            class="button left"
                            aria-label="Previous Date"
                            @click="handleDateChange(-1)"
                        >
                            <svg
                                aria-hidden="true"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M10 3L5 8L10 13"
                                    stroke="currentColor"
                                    stroke-width="1.75"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                        <button
                            id="date-subtitle"
                            aria-label="Reset to current date"
                            @click="resetDate"
                        >
                            {{ dateSubtitle }}
                        </button>
                        <button
                            class="button right"
                            aria-label="Next Date"
                            @click="handleDateChange(+1)"
                        >
                            <svg
                                aria-hidden="true"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M6 3L11 8L6 13"
                                    stroke="currentColor"
                                    stroke-width="1.75"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                    </nav>

                    <nav class="tabs" role="tablist" aria-label="Event source">
                        <button
                            id="tab-personal-button"
                            class="tab"
                            role="tab"
                            accesskey="1"
                            aria-controls="tab-personal"
                            :aria-selected="selectedTab === 'tab-personal'"
                            :class="{ active: selectedTab === 'tab-personal' }"
                            @click="selectTab('tab-personal')"
                        >
                            Personal Events
                        </button>
                        <button
                            v-if="shouldShowHistoryTab"
                            id="tab-history-button"
                            class="tab"
                            role="tab"
                            accesskey="2"
                            aria-controls="tab-history"
                            :aria-selected="selectedTab === 'tab-history'"
                            :class="{ active: selectedTab === 'tab-history' }"
                            @click="selectTab('tab-history')"
                        >
                            Historical Events
                        </button>
                    </nav>
                </div>
            </header>

            <main class="tabs-container">
                <Transition name="panel-swap" mode="out-in">
                    <div
                        v-if="selectedTab === 'tab-personal'"
                        id="tab-personal"
                        key="tab-personal"
                        class="tab-content"
                        role="tabpanel"
                        aria-labelledby="tab-personal-button"
                    >
                        <fieldset class="mode">
                            <legend class="visually-hidden">View Mode</legend>
                            <label class="mode-option">
                                <input
                                    v-model="viewMode"
                                    type="radio"
                                    name="view-mode"
                                    value="day"
                                    accesskey="d"
                                />
                                <span data-mobile-label="Day">Day</span>
                            </label>
                            <label class="mode-option">
                                <input
                                    v-model="viewMode"
                                    type="radio"
                                    name="view-mode"
                                    value="week"
                                    accesskey="w"
                                />
                                <span data-mobile-label="Week">Week</span>
                            </label>
                            <label class="mode-option">
                                <input
                                    v-model="viewMode"
                                    type="radio"
                                    name="view-mode"
                                    value="month"
                                    accesskey="m"
                                />
                                <span data-mobile-label="Month">Month</span>
                            </label>
                            <label class="mode-option">
                                <input
                                    v-model="viewMode"
                                    type="radio"
                                    name="view-mode"
                                    value="dayOfMonth"
                                />
                                <span data-mobile-label="Month Day">Day of the Month</span>
                            </label>
                        </fieldset>

                        <div
                            id="events-container"
                            class="event-list"
                            aria-live="polite"
                            aria-label="Personal Events"
                        >
                            <Transition name="event-stack-fade" mode="out-in">
                                <div v-if="showLoading" key="personal-loading" class="loading">
                                    Loading...
                                </div>
                                <div
                                    v-else-if="icsError"
                                    key="personal-error"
                                    class="no-events-message"
                                >
                                    {{ getIcsErrorMessage }}
                                </div>
                                <div v-else :key="personalMotionContext" class="event-stack">
                                    <div
                                        v-if="
                                            icsStatus !== 'pending' &&
                                            !showLoading &&
                                            filteredPersonalEvents.length === 0
                                        "
                                        class="no-events-message"
                                    >
                                        Nothing found. Looks like today is a quiet day in history.
                                    </div>
                                    <!-- oxlint-disable vue/no-v-html -->
                                    <article
                                        v-for="(event, idx) in filteredPersonalEvents"
                                        :key="getEventKey('personal', event)"
                                        :style="{ '--stagger-index': idx }"
                                        class="event"
                                        v-html="renderEventHtml(event)"
                                    />
                                    <!-- oxlint-enable -->
                                </div>
                            </Transition>
                        </div>
                    </div>

                    <div
                        v-else-if="shouldShowHistoryTab"
                        id="tab-history"
                        key="tab-history"
                        class="tab-content"
                        role="tabpanel"
                        aria-labelledby="tab-history-button"
                    >
                        <div
                            id="history-container"
                            class="event-list"
                            aria-live="polite"
                            aria-label="Historical Events"
                        >
                            <Transition name="event-stack-fade" mode="out-in">
                                <div
                                    v-if="wikiStatus === 'pending'"
                                    key="history-loading"
                                    class="loading"
                                >
                                    Loading...
                                </div>
                                <div
                                    v-else-if="wikiError"
                                    key="history-error"
                                    class="no-events-message"
                                >
                                    {{ getWikiErrorMessage }}
                                </div>
                                <div v-else :key="historyMotionContext" class="event-stack">
                                    <div
                                        v-if="historyEvents.length === 0"
                                        class="no-events-message"
                                    >
                                        Nothing found. Looks like today is a quiet day in history.
                                    </div>
                                    <!-- oxlint-disable vue/no-v-html -->
                                    <article
                                        v-for="(event, idx) in historyEvents"
                                        :key="getEventKey('history', event)"
                                        :style="{ '--stagger-index': idx }"
                                        class="event"
                                        v-html="renderEventHtml(event)"
                                    />
                                    <!-- oxlint-enable -->
                                </div>
                            </Transition>
                        </div>
                    </div>
                </Transition>
            </main>
        </div>
    </div>
</template>
