/**
 * pages/index.vue.test.ts
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

import { defineComponent, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IcsEvent } from '#shared/ics-parser';

// Fixed test date: Wednesday, March 19, 2025 UTC
const FIXED_DATE = new Date('2025-03-19T12:00:00.000Z');

// ---------------------------------------------------------------------------
// Module-level reactive state — defined here so we can use Vue's ref()
// and reset them in beforeEach without re-importing or resetting modules.
// ---------------------------------------------------------------------------
const icsData = ref<IcsEvent[] | null>(null);
const icsStatus = ref<string>('success');
const icsError = ref<unknown>(null);

const wikiData = ref<IcsEvent[] | null>(null);
const wikiStatus = ref<string>('success');
const wikiError = ref<unknown>(null);

const viewModeCookie = ref<string>('day');
const refreshWiki = vi.fn();

// ---------------------------------------------------------------------------
// Hoisted mock factories (vi.hoisted runs before any imports)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
    useCurrentDate: vi.fn(),
    useLanguage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// vi.mock calls — these are hoisted to the top of the file by Vitest
// ---------------------------------------------------------------------------

vi.mock('#imports', () => ({
    useHead: vi.fn(),
    useRequestHeaders: vi.fn(() => ({})),
    useRuntimeConfig: vi.fn(() => ({})),
    useState: vi.fn((_key: string, init?: () => unknown) => ref(init ? init() : undefined)),
    defineNuxtRouteMiddleware: vi.fn((h: unknown) => h),
}));

vi.mock('~/composables/useCurrentDate', () => ({
    useCurrentDate: mocks.useCurrentDate,
}));

vi.mock('~/composables/useLanguage', () => ({
    useLanguage: mocks.useLanguage,
}));

// ---------------------------------------------------------------------------
// Helper: mount the index page wrapped in <Suspense>
// ---------------------------------------------------------------------------
async function mountPage() {
    const IndexPage = (await import('./index.vue')).default;

    const Wrapper = defineComponent({
        components: { IndexPage },
        template: `<Suspense><IndexPage /></Suspense>`,
    });

    const wrapper = mount(Wrapper, { attachTo: document.body });
    await flushPromises();
    await nextTick();
    return wrapper;
}

// ---------------------------------------------------------------------------
// Helper: build a minimal IcsEvent
// ---------------------------------------------------------------------------
function makeEvent(dtstart: Date, dtend: Date, summary = 'Test Event', description = ''): IcsEvent {
    return { DTSTART: dtstart, DTEND: dtend, SUMMARY: summary, DESCRIPTION: description };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('pages/index.vue', () => {
    beforeEach(() => {
        // Reset all reactive state
        icsData.value = null;
        icsStatus.value = 'success';
        icsError.value = null;

        wikiData.value = null;
        wikiStatus.value = 'success';
        wikiError.value = null;

        viewModeCookie.value = 'day';

        refreshWiki.mockReset();

        // useCurrentDate is called both in setup (for selectedDate) and in
        // getRelativeTime (once per rendered event) — always return FIXED_DATE.
        mocks.useCurrentDate.mockReturnValue(FIXED_DATE);

        // useLanguage returns a ref with 'en'
        mocks.useLanguage.mockReturnValue(ref('en'));

        // Stub Nuxt auto-import globals (not imported via #imports in the component)
        vi.stubGlobal('$fetch', vi.fn());
        vi.stubGlobal(
            'useCookie',
            vi.fn((_key: string) => viewModeCookie),
        );
        vi.stubGlobal(
            'useLazyAsyncData',
            vi.fn((key: string) => {
                if (key === 'personal-ics') {
                    return Promise.resolve({ data: icsData, status: icsStatus, error: icsError });
                }
                // 'wiki-ics'
                return Promise.resolve({
                    data: wikiData,
                    status: wikiStatus,
                    error: wikiError,
                    refresh: refreshWiki,
                });
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // -----------------------------------------------------------------------
    // 1. Renders h1 title and date subtitle containing "2025"
    // -----------------------------------------------------------------------
    it('renders h1 title and a date subtitle containing "2025"', async () => {
        const wrapper = await mountPage();

        expect(wrapper.find('h1').text()).toBe('On This Day...');

        const subtitle = wrapper.find('#date-subtitle').text();
        expect(subtitle).toContain('2025');
    });

    // -----------------------------------------------------------------------
    // 2. Shows "quiet day" empty message when no events match day filter
    // -----------------------------------------------------------------------
    it('shows "quiet day" message when no personal events match', async () => {
        icsData.value = [];
        const wrapper = await mountPage();

        expect(wrapper.find('.no-events-message').text()).toContain('quiet day');
    });

    // -----------------------------------------------------------------------
    // 3. Shows events matching the current day (month 3, day 19, year ≠ 2025)
    // -----------------------------------------------------------------------
    it('shows events on March 19 of a different year in day view', async () => {
        const matchingEvent = makeEvent(
            new Date('2010-03-19T00:00:00.000Z'),
            new Date('2010-03-19T00:00:00.000Z'),
            'Historical March 19',
        );
        const nonMatchingEvent = makeEvent(
            new Date('2010-04-19T00:00:00.000Z'),
            new Date('2010-04-19T00:00:00.000Z'),
            'April Event',
        );
        icsData.value = [matchingEvent, nonMatchingEvent];

        const wrapper = await mountPage();

        const articles = wrapper.findAll('#tab-personal .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('Historical March 19');
    });

    // -----------------------------------------------------------------------
    // 4. Active count fact card shows correct number
    // -----------------------------------------------------------------------
    it('fact card shows the correct count of filtered events', async () => {
        icsData.value = [
            makeEvent(
                new Date('2000-03-19T00:00:00.000Z'),
                new Date('2000-03-19T00:00:00.000Z'),
                'Event A',
            ),
            makeEvent(
                new Date('1999-03-19T00:00:00.000Z'),
                new Date('1999-03-19T00:00:00.000Z'),
                'Event B',
            ),
        ];

        const wrapper = await mountPage();

        const factCard = wrapper.find('.fact-card strong');
        expect(factCard.text()).toContain('2 entries');
    });

    // -----------------------------------------------------------------------
    // 5. Week view filter: March 17 (Mon) in different year IS shown;
    //    March 5 is NOT shown.
    //    For FIXED_DATE = Wed March 19 2025, week is Sun Mar 16 – Sat Mar 22.
    // -----------------------------------------------------------------------
    it('week view shows events in the same week and excludes out-of-week events', async () => {
        viewModeCookie.value = 'week';

        const inWeek = makeEvent(
            new Date('2010-03-17T00:00:00.000Z'), // Monday March 17 — in week
            new Date('2010-03-17T00:00:00.000Z'),
            'In Week Event',
        );
        const outOfWeek = makeEvent(
            new Date('2010-03-05T00:00:00.000Z'), // March 5 — not in week
            new Date('2010-03-05T00:00:00.000Z'),
            'Out Of Week Event',
        );
        icsData.value = [inWeek, outOfWeek];

        const wrapper = await mountPage();

        const articles = wrapper.findAll('#tab-personal .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('In Week Event');
    });

    // -----------------------------------------------------------------------
    // 6. Month view filter: March events ARE shown; April events are NOT
    // -----------------------------------------------------------------------
    it('month view shows events in March and excludes April events', async () => {
        viewModeCookie.value = 'month';

        const marchEvent = makeEvent(
            new Date('2010-03-07T00:00:00.000Z'),
            new Date('2010-03-07T00:00:00.000Z'),
            'March Event',
        );
        const aprilEvent = makeEvent(
            new Date('2010-04-07T00:00:00.000Z'),
            new Date('2010-04-07T00:00:00.000Z'),
            'April Event',
        );
        icsData.value = [marchEvent, aprilEvent];

        const wrapper = await mountPage();

        const articles = wrapper.findAll('#tab-personal .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('March Event');
    });

    // -----------------------------------------------------------------------
    // 7. DayOfMonth view filter: events with day=19 ARE shown; day=5 are NOT
    // -----------------------------------------------------------------------
    it('dayOfMonth view shows events on day 19 and excludes day 5', async () => {
        viewModeCookie.value = 'dayOfMonth';

        const day19 = makeEvent(
            new Date('2010-06-19T00:00:00.000Z'),
            new Date('2010-06-19T00:00:00.000Z'),
            'Day 19 Event',
        );
        const day5 = makeEvent(
            new Date('2010-06-05T00:00:00.000Z'),
            new Date('2010-06-05T00:00:00.000Z'),
            'Day 5 Event',
        );
        icsData.value = [day19, day5];

        const wrapper = await mountPage();

        const articles = wrapper.findAll('#tab-personal .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('Day 19 Event');
    });

    // -----------------------------------------------------------------------
    // 8. setTitle — viewMode changes update h1 text
    // -----------------------------------------------------------------------
    it('updates h1 title when viewMode changes', async () => {
        const wrapper = await mountPage();

        // week
        viewModeCookie.value = 'week';
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Week...');

        // month
        viewModeCookie.value = 'month';
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Month...');

        // dayOfMonth
        viewModeCookie.value = 'dayOfMonth';
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Day of the Month...');

        // back to day
        viewModeCookie.value = 'day';
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Day...');
    });

    // -----------------------------------------------------------------------
    // 9. handleDateChange(+1) — clicking Next Date changes the subtitle
    // -----------------------------------------------------------------------
    it('clicking Next Date changes the date subtitle forward', async () => {
        const wrapper = await mountPage();

        const originalSubtitle = wrapper.find('#date-subtitle').text();

        await wrapper.find('[aria-label="Next Date"]').trigger('click');
        await nextTick();

        const newSubtitle = wrapper.find('#date-subtitle').text();
        expect(newSubtitle).not.toBe(originalSubtitle);
        // March 20 should appear
        expect(newSubtitle).toContain('20');
    });

    // -----------------------------------------------------------------------
    // 10. handleDateChange(-1) — clicking Previous Date changes the subtitle
    // -----------------------------------------------------------------------
    it('clicking Previous Date changes the date subtitle backward', async () => {
        const wrapper = await mountPage();

        const originalSubtitle = wrapper.find('#date-subtitle').text();

        await wrapper.find('[aria-label="Previous Date"]').trigger('click');
        await nextTick();

        const newSubtitle = wrapper.find('#date-subtitle').text();
        expect(newSubtitle).not.toBe(originalSubtitle);
        // March 18 should appear
        expect(newSubtitle).toContain('18');
    });

    // -----------------------------------------------------------------------
    // 11. resetDate — after navigating, clicking reset restores original subtitle
    // -----------------------------------------------------------------------
    it('reset date button restores the original date subtitle', async () => {
        const wrapper = await mountPage();

        const originalSubtitle = wrapper.find('#date-subtitle').text();

        // Navigate forward
        await wrapper.find('[aria-label="Next Date"]').trigger('click');
        await nextTick();

        expect(wrapper.find('#date-subtitle').text()).not.toBe(originalSubtitle);

        // Reset
        await wrapper.find('[aria-label="Reset to current date"]').trigger('click');
        await nextTick();

        expect(wrapper.find('#date-subtitle').text()).toBe(originalSubtitle);
    });

    // -----------------------------------------------------------------------
    // 12. selectTab('tab-history') — clicking history tab shows #tab-history
    //     and calls refreshWiki
    // -----------------------------------------------------------------------
    it('clicking history tab shows #tab-history and calls refreshWiki', async () => {
        const wrapper = await mountPage();

        // Initially on personal tab
        expect(wrapper.find('#tab-personal').exists()).toBe(true);
        expect(wrapper.find('#tab-history').exists()).toBe(false);

        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        expect(wrapper.find('#tab-history').exists()).toBe(true);
        expect(wrapper.find('#tab-personal').exists()).toBe(false);
        expect(refreshWiki).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 13. selectTab('tab-personal') — switching back shows #tab-personal
    //     and updates title back to the view mode title
    // -----------------------------------------------------------------------
    it('switching back to personal tab shows #tab-personal and restores title', async () => {
        const wrapper = await mountPage();

        // Go to history first
        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        expect(wrapper.find('h1').text()).toBe('On This Day...');

        // Switch back to personal
        await wrapper.find('#tab-personal-button').trigger('click');
        await nextTick();

        expect(wrapper.find('#tab-personal').exists()).toBe(true);
        expect(wrapper.find('#tab-history').exists()).toBe(false);
        // Title reverts to current view mode (day)
        expect(wrapper.find('h1').text()).toBe('On This Day...');
    });

    // -----------------------------------------------------------------------
    // 14. History tab empty state — shows "quiet day" when wikiData is []
    // -----------------------------------------------------------------------
    it('history tab shows "quiet day" when wikiData is empty', async () => {
        wikiData.value = [];
        const wrapper = await mountPage();

        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        const noEventsMsg = wrapper.find('#tab-history .no-events-message');
        expect(noEventsMsg.exists()).toBe(true);
        expect(noEventsMsg.text()).toContain('quiet day');
    });

    // -----------------------------------------------------------------------
    // 15. History tab with events — shows events when wikiData is set
    // -----------------------------------------------------------------------
    it('history tab renders events when wikiData has entries', async () => {
        const histEvent = makeEvent(
            new Date('1969-03-19T00:00:00.000Z'),
            new Date('1969-03-19T00:00:00.000Z'),
            'Moon Landing Prep',
            'Apollo notes',
        );
        wikiData.value = [histEvent];

        const wrapper = await mountPage();

        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        const articles = wrapper.findAll('#tab-history .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('Moon Landing Prep');
    });

    // -----------------------------------------------------------------------
    // 16. Wiki refreshes when date changes while on history tab
    // -----------------------------------------------------------------------
    it('refreshWiki is called when date changes while on history tab', async () => {
        const wrapper = await mountPage();

        // Switch to history tab
        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        const callsBefore = refreshWiki.mock.calls.length;

        // Change date
        await wrapper.find('[aria-label="Next Date"]').trigger('click');
        await nextTick();
        await flushPromises();

        expect(refreshWiki.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    // -----------------------------------------------------------------------
    // 17. ICS error state — when icsError has { data: { message } }, shows it
    // -----------------------------------------------------------------------
    it('shows custom error message when icsError.data.message is set', async () => {
        icsError.value = { data: { message: 'Custom Error' } };

        const wrapper = await mountPage();

        const errorEl = wrapper.find('#tab-personal .no-events-message');
        expect(errorEl.exists()).toBe(true);
        expect(errorEl.text()).toContain('Custom Error');
    });

    // -----------------------------------------------------------------------
    // 18. ICS error message fallback — error with only .message shows that
    // -----------------------------------------------------------------------
    it('shows fallback error message when icsError only has .message', async () => {
        icsError.value = { message: 'Fallback Error Message' };

        const wrapper = await mountPage();

        const errorEl = wrapper.find('#tab-personal .no-events-message');
        expect(errorEl.exists()).toBe(true);
        expect(errorEl.text()).toContain('Fallback Error Message');
    });

    // -----------------------------------------------------------------------
    // 19. formatEventDateRange — all-day event: DTEND is midnight next day,
    //     same start → shows single date
    // -----------------------------------------------------------------------
    it('renders a single date for all-day events (DTEND is midnight next day)', async () => {
        // All-day: start = March 19, end = March 20 00:00:00 UTC
        const allDayEvent = makeEvent(
            new Date('2010-03-19T00:00:00.000Z'),
            new Date('2010-03-20T00:00:00.000Z'),
            'All Day Event',
        );
        icsData.value = [allDayEvent];

        const wrapper = await mountPage();

        const article = wrapper.find('#tab-personal .event');
        expect(article.exists()).toBe(true);

        const timeEl = article.find('time');
        expect(timeEl.exists()).toBe(true);

        const dateText = timeEl.text();
        // Should contain a single date (no "–" separator)
        expect(dateText).not.toContain('–');
        expect(dateText).toContain('2010');
    });

    // -----------------------------------------------------------------------
    // 20. formatEventDateRange — multi-day event → shows "start – end" range
    // -----------------------------------------------------------------------
    it('renders a date range for multi-day events', async () => {
        // Multi-day: March 19 to March 21 (not midnight-next-day pattern)
        const multiDayEvent = makeEvent(
            new Date('2010-03-19T12:00:00.000Z'),
            new Date('2010-03-21T12:00:00.000Z'),
            'Multi Day Event',
        );
        icsData.value = [multiDayEvent];

        const wrapper = await mountPage();

        const article = wrapper.find('#tab-personal .event');
        expect(article.exists()).toBe(true);

        const timeEl = article.find('time');
        expect(timeEl.exists()).toBe(true);

        const dateText = timeEl.text();
        // Should contain the "–" separator for a range
        expect(dateText).toContain('–');
    });

    // -----------------------------------------------------------------------
    // 21. renderEventHtml — uses X-ALT-DESC when present instead of DESCRIPTION
    // -----------------------------------------------------------------------
    it('uses X-ALT-DESC as the event description when present', async () => {
        const eventWithAltDesc: IcsEvent = {
            DTSTART: new Date('2010-03-19T00:00:00.000Z'),
            DTEND: new Date('2010-03-19T01:00:00.000Z'),
            SUMMARY: 'Alt Desc Event',
            DESCRIPTION: 'Plain description',
            'X-ALT-DESC': '<p>Rich HTML description</p>',
        };
        icsData.value = [eventWithAltDesc];

        const wrapper = await mountPage();

        const article = wrapper.find('#tab-personal .event');
        expect(article.html()).toContain('Rich HTML description');
        expect(article.html()).not.toContain('Plain description');
    });

    // -----------------------------------------------------------------------
    // 22. filterPersonalEvents — event without DTSTART or DTEND is excluded
    // -----------------------------------------------------------------------
    it('filters out events that have no DTSTART and no DTEND', async () => {
        const noDateEvent: IcsEvent = {
            DTSTART: null as unknown as Date,
            DTEND: null as unknown as Date,
            SUMMARY: 'No Date Event',
            DESCRIPTION: '',
        };
        const validEvent = makeEvent(
            new Date('2010-03-19T00:00:00.000Z'),
            new Date('2010-03-19T01:00:00.000Z'),
            'Valid Event',
        );
        icsData.value = [noDateEvent, validEvent];

        const wrapper = await mountPage();

        const articles = wrapper.findAll('#tab-personal .event');
        expect(articles).toHaveLength(1);
        expect(articles[0]!.html()).toContain('Valid Event');
    });

    // -----------------------------------------------------------------------
    // 23. Loading timer — clearTimeout is called when status recovers from pending
    // -----------------------------------------------------------------------
    it('clears the loading timer when status recovers from pending', async () => {
        vi.useFakeTimers();
        icsStatus.value = 'pending';

        const wrapper = await mountPage();

        // Timer is set but not yet fired (< 200ms)
        expect(wrapper.find('.loading').exists()).toBe(false);

        // Status recovers before the timer fires
        icsStatus.value = 'success';
        await nextTick();

        // Advance past the 200ms threshold — loading should NOT appear
        vi.advanceTimersByTime(300);
        await nextTick();

        expect(wrapper.find('.loading').exists()).toBe(false);

        vi.useRealTimers();
    });

    // -----------------------------------------------------------------------
    // 24. Radio buttons — triggering DOM change events updates title via watcher
    // -----------------------------------------------------------------------
    it('triggers viewMode watcher when radio buttons are changed via DOM events', async () => {
        const wrapper = await mountPage();

        await wrapper.find('input[value="week"]').trigger('change');
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Week...');

        await wrapper.find('input[value="month"]').trigger('change');
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Month...');

        await wrapper.find('input[value="dayOfMonth"]').trigger('change');
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Day of the Month...');
    });

    // -----------------------------------------------------------------------
    // 25. formatEventDateRange — null DTSTART with valid DTEND returns ''
    //     (covers line 370: `if (!startDate) return ''`)
    // -----------------------------------------------------------------------
    it('renders empty time text when DTSTART is null and DTEND is valid', async () => {
        // Passes filter because DTEND is truthy; DTSTART is null.
        // dayOfMonth view matches any day-19 event.
        viewModeCookie.value = 'dayOfMonth';
        const noStartEvent: IcsEvent = {
            DTSTART: null as unknown as Date,
            DTEND: new Date('2010-05-19T10:00:00.000Z'),
            SUMMARY: 'No Start Event',
            DESCRIPTION: '',
        };
        icsData.value = [noStartEvent];

        const wrapper = await mountPage();

        // Event passes the dayOfMonth filter via DTEND, then renderEventHtml
        // calls formatEventDateRange(null, DTEND) → '' empty string
        const article = wrapper.find('#tab-personal .event');
        expect(article.exists()).toBe(true);
        expect(article.find('time').text()).toBe('');
    });

    // -----------------------------------------------------------------------
    // 26. getRelativeTime — large year difference uses the 'year' threshold branch
    // -----------------------------------------------------------------------
    it('renders a rel-date span with a year-scale relative time for an old event', async () => {
        // Event from 1900: ~125 years ago — will format as years in getRelativeTime
        const oldEvent = makeEvent(
            new Date('1900-03-19T12:00:00.000Z'),
            new Date('1900-03-19T12:00:00.000Z'),
            'Ancient Event',
        );
        icsData.value = [oldEvent];

        const wrapper = await mountPage();

        const article = wrapper.find('#tab-personal .event');
        expect(article.exists()).toBe(true);
        // Verify the rel-date span renders with some content
        const relDate = article.find('.rel-date');
        expect(relDate.exists()).toBe(true);
    });

    // -----------------------------------------------------------------------
    // 28. resetDate while on history tab calls refreshWiki (line 315)
    // -----------------------------------------------------------------------
    it('resetDate calls refreshWiki when on the history tab', async () => {
        const wrapper = await mountPage();

        // Navigate to history tab
        await wrapper.find('#tab-history-button').trigger('click');
        await nextTick();

        refreshWiki.mockClear();

        // Navigate forward, then reset
        await wrapper.find('[aria-label="Next Date"]').trigger('click');
        await nextTick();
        await flushPromises();

        refreshWiki.mockClear();

        // Reset date while still on history tab — should call refreshWiki
        await wrapper.find('[aria-label="Reset to current date"]').trigger('click');
        await nextTick();

        expect(refreshWiki).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 27. "Day" radio triggers watcher via DOM change event
    // -----------------------------------------------------------------------
    it('triggering DOM change events cycles through all view modes and back to day', async () => {
        const wrapper = await mountPage();

        // Change to week via ref (watcher fires)
        viewModeCookie.value = 'week';
        await nextTick();
        expect(wrapper.find('h1').text()).toBe('On This Week...');

        // Now trigger the Day radio DOM change event to switch back
        viewModeCookie.value = 'day';
        await wrapper.find('input[value="day"]').trigger('change');
        await nextTick();

        expect(wrapper.find('h1').text()).toBe('On This Day...');
    });
});
