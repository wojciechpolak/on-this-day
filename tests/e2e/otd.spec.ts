/**
 * otd.spec.ts
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

import { expect, test, type Locator, type Page } from '@playwright/test';
import { getCurrentDate } from './vrt-now';

type WikiEvent = {
    DTSTART: string;
    DTEND: string;
    DESCRIPTION: string;
    SUMMARY: string;
    [key: string]: string;
};

type WikiRequest = {
    date: string;
    lang: string;
    url: string;
};

async function screenshotIfVisual(target: Page | Locator, name: string, mask: Locator[] = []) {
    if (!process.env.VRT) {
        return;
    }

    await expect(target).toHaveScreenshot(name, {
        animations: 'disabled',
        caret: 'hide',
        mask,
    });
}

function addUtcDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function formatYmd(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatSubtitle(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

const today = getCurrentDate();
const todayIso = formatYmd(today);
const tomorrow = addUtcDays(today, 1);
const tomorrowIso = formatYmd(tomorrow);
const todaySubtitle = formatSubtitle(today, 'en-US');
const tomorrowSubtitle = formatSubtitle(tomorrow, 'en-US');
const todaySubtitlePl = formatSubtitle(today, 'pl-PL');

const defaultWikiEvents: WikiEvent[] = [
    {
        DTSTART: '1985-03-19T00:00:00.000Z',
        DTEND: '1985-03-19T00:00:00.000Z',
        SUMMARY: 'Events: Historical milestone',
        DESCRIPTION: 'History link https://en.wikipedia.org/wiki/On_This_Day',
    },
    {
        DTSTART: '1999-03-19T00:00:00.000Z',
        DTEND: '1999-03-19T00:00:00.000Z',
        SUMMARY: 'Births: Another historical event',
        DESCRIPTION: 'Another wiki entry',
    },
];

const nextDayWikiEvents: WikiEvent[] = [
    {
        DTSTART: '1991-03-20T00:00:00.000Z',
        DTEND: '1991-03-20T00:00:00.000Z',
        SUMMARY: 'Events: Next day historical event',
        DESCRIPTION: 'New day https://wikipedia.org/wiki/Next_Day',
    },
];

async function installWikipediaMock(
    page: Page,
    responses: Record<string, WikiEvent[]> = {
        [todayIso]: defaultWikiEvents,
        [tomorrowIso]: nextDayWikiEvents,
    },
    delayMs = 0,
) {
    const requests: WikiRequest[] = [];

    await page.route('**/api/fetch-wikipedia**', async (route) => {
        const url = new URL(route.request().url());
        const date = url.searchParams.get('date') ?? 'default';
        const lang = url.searchParams.get('lang') ?? '';
        const body = responses[date] ?? responses.default ?? defaultWikiEvents;

        requests.push({
            date,
            lang,
            url: url.toString(),
        });

        if (delayMs > 0) {
            await page.waitForTimeout(delayMs);
        }

        await route.fulfill({
            status: 200,
            contentType: 'text/plain; charset=utf-8',
            body: JSON.stringify(body),
        });
    });

    return requests;
}

async function gotoHome(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.describe.serial('On This Day', () => {
    test('renders personal events from the mocked ICS sources', async ({ page }) => {
        await installWikipediaMock(page);
        await gotoHome(page);

        await expect(page.getByRole('heading', { name: 'On This Day...' })).toBeVisible();
        await expect(page.getByLabel('Reset to current date')).toContainText(todaySubtitle);
        await expect(page.locator('#events-container .event')).toHaveCount(1);
        await expect(page.locator('#events-container')).toContainText('Personal Day Event');
        await expect(page.locator('#events-container')).toContainText('Day event with');
        await expect(
            page.locator('#events-container a[href="https://example.com/day"]'),
        ).toBeVisible();
        await screenshotIfVisual(page, 'personal-day-view.png');
    });

    test('filters personal events across day, week, month, and day-of-month views', async ({
        page,
    }) => {
        await installWikipediaMock(page);
        await gotoHome(page);

        const dayRadio = page.getByRole('radio', { name: 'Day', exact: true });
        const weekRadio = page.getByRole('radio', { name: 'Week', exact: true });
        const monthRadio = page.getByRole('radio', { name: 'Month', exact: true });
        const dayOfMonthRadio = page.getByRole('radio', { name: 'Day of the Month', exact: true });
        const eventsContainer = page.locator('#events-container');

        await expect(eventsContainer.locator('.event')).toHaveCount(1);

        await weekRadio.check();
        await expect(eventsContainer.locator('.event')).toHaveCount(2);
        await expect(eventsContainer).toContainText('Personal Week Event');

        await monthRadio.check();
        await expect(eventsContainer.locator('.event')).toHaveCount(3);
        await expect(eventsContainer).toContainText('Personal Month Event');

        await dayOfMonthRadio.check();
        await expect(eventsContainer.locator('.event')).toHaveCount(3);
        await expect(eventsContainer).toContainText('Personal Day of Month Event');
        await expect(eventsContainer).toContainText('Current Year Excluded Event');

        await dayRadio.check();
        await expect(eventsContainer.locator('.event')).toHaveCount(1);
        await expect(eventsContainer).toContainText('Personal Day Event');
    });

    test('keeps the selected personal view mode after reloading the page', async ({ page }) => {
        await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('radio', { name: 'Month', exact: true }).check();
        await expect(page.getByRole('heading', { name: 'On This Month...' })).toBeVisible();
        await expect(page.locator('#events-container .event')).toHaveCount(3);

        await page.reload();

        await expect(page.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        await expect(page.locator('#events-container .event')).toHaveCount(3);
    });

    test('shows an empty personal state after moving to a date with no matches', async ({
        page,
    }) => {
        await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('button', { name: 'Next Date' }).click();

        await expect(page.getByLabel('Reset to current date')).toContainText(tomorrowSubtitle);
        await expect(page.locator('#events-container .no-events-message')).toContainText(
            'Nothing found. Looks like today is a quiet day in history.',
        );
        await expect(page.locator('#events-container .event')).toHaveCount(0);
        await screenshotIfVisual(page, 'empty-personal-state.png');
    });

    test('switches to the history tab and renders mocked wikipedia events', async ({ page }) => {
        const wikiRequests = await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('tab', { name: 'Historical Events' }).click();

        const historyEvents = page.locator('#history-container .event');
        await expect(historyEvents).toHaveCount(2);
        await expect(page.locator('#history-container')).toContainText(
            'Events: Historical milestone',
        );
        await expect(page.locator('#history-container')).toContainText(
            'Births: Another historical event',
        );
        await expect(
            page.locator('#history-container a[href="https://en.wikipedia.org/wiki/On_This_Day"]'),
        ).toBeVisible();
        await expect(page.getByRole('heading', { name: 'On This Day...' })).toBeVisible();
        await expect(wikiRequests).toHaveLength(1);
        expect(wikiRequests[0]).toMatchObject({ date: todayIso, lang: 'en' });
        await screenshotIfVisual(page, 'history-tab.png');
    });

    test('shows a loading state while wikipedia data is pending', async ({ page }) => {
        await installWikipediaMock(page, undefined, 1_500);
        await gotoHome(page);

        await page.getByRole('tab', { name: 'Historical Events' }).click();
        await expect(page.locator('#history-container .loading')).toBeVisible();
        await expect(page.locator('#history-container .event')).toHaveCount(2);
    });

    test('shows an empty history state when wikipedia returns no events', async ({ page }) => {
        await installWikipediaMock(page, {
            [todayIso]: [],
        });
        await gotoHome(page);

        await page.getByRole('tab', { name: 'Historical Events' }).click();

        await expect(page.locator('#history-container .no-events-message')).toContainText(
            'Nothing found. Looks like today is a quiet day in history.',
        );
        await expect(page.locator('#history-container .event')).toHaveCount(0);
    });

    test('refetches wikipedia data when the selected date changes on the history tab', async ({
        page,
    }) => {
        const wikiRequests = await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('tab', { name: 'Historical Events' }).click();
        await expect(page.locator('#history-container')).toContainText(
            'Events: Historical milestone',
        );

        await page.getByRole('button', { name: 'Next Date' }).click();

        await expect(page.getByLabel('Reset to current date')).toContainText(tomorrowSubtitle);
        await expect(page.locator('#history-container')).toContainText(
            'Events: Next day historical event',
        );
        await expect
            .poll(() => wikiRequests.map((request) => request.date))
            .toEqual([todayIso, tomorrowIso, tomorrowIso]);
    });

    test.describe('Polish locale', () => {
        test.use({ locale: 'pl-PL' });

        test('uses the browser locale when requesting wikipedia data', async ({ page }) => {
            const wikiRequests = await installWikipediaMock(page);
            await gotoHome(page);

            await page.getByRole('tab', { name: 'Historical Events' }).click();

            await expect(page.getByLabel('Reset to current date')).toContainText(todaySubtitlePl);
            await expect.poll(() => wikiRequests[0]?.lang ?? '').toBe('pl');
        });
    });

    test('restores personal events after resetting the date', async ({ page }) => {
        await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('button', { name: 'Next Date' }).click();
        await expect(page.locator('#events-container .no-events-message')).toContainText(
            'Nothing found. Looks like today is a quiet day in history.',
        );

        await page.getByRole('button', { name: 'Reset to current date' }).click();

        await expect(page.getByLabel('Reset to current date')).toContainText(todaySubtitle);
        await expect(page.locator('#events-container .event')).toHaveCount(1);
        await expect(page.locator('#events-container')).toContainText('Personal Day Event');
    });

    test('changes the date subtitle with the previous, next, and reset controls', async ({
        page,
    }) => {
        const wikiRequests = await installWikipediaMock(page);
        await gotoHome(page);

        await page.getByRole('button', { name: 'Next Date' }).click();
        await expect(page.getByLabel('Reset to current date')).toContainText(tomorrowSubtitle);

        await page.getByRole('button', { name: 'Previous Date' }).click();
        await expect(page.getByLabel('Reset to current date')).toContainText(todaySubtitle);

        await page.getByRole('button', { name: 'Reset to current date' }).click();
        await expect(page.getByLabel('Reset to current date')).toContainText(todaySubtitle);
        await expect(wikiRequests).toHaveLength(0);
    });
});
