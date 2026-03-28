/**
 * start-playwright-webserver.mjs
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

import { spawn } from 'node:child_process';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const nuxtCli = path.join(rootDir, 'node_modules/nuxt/bin/nuxt.mjs');
const defaultVrtFixedDate = '2026-03-21T12:00:00.000Z';

function resolveVrtFixedDate(value) {
    if (value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    }

    return defaultVrtFixedDate;
}

function utcNow() {
    const fixedVrtNow =
        process.env.VRT === '1' ? resolveVrtFixedDate(process.env.VRT_FIXED_DATE) : '';
    if (fixedVrtNow) {
        const fixedDate = new Date(fixedVrtNow);
        if (!Number.isNaN(fixedDate.getTime())) {
            return fixedDate;
        }
    }

    const now = new Date();
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0),
    );
}

function addUtcDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function makeUtcDate(year, month, day, hour = 0, minute = 0, second = 0) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function findMonthWithDay(day, currentMonth, year) {
    for (let offset = 1; offset <= 12; offset += 1) {
        const month = (currentMonth + offset) % 12;
        if (daysInMonth(year, month) >= day) {
            return month;
        }
    }

    return currentMonth;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

function formatIcsDateTime(date) {
    return (
        [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join('') +
        'T' +
        [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join('') +
        'Z'
    );
}

function formatIcsDate(date) {
    return [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join('');
}

function createEvent({ uid, start, end, summary, description, allDay = false }) {
    const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatIcsDateTime(makeUtcDate(2025, 0, 1, 0, 0, 0))}`,
    ];

    if (allDay) {
        lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(start)}`);
        lines.push(`DTEND;VALUE=DATE:${formatIcsDate(end)}`);
    } else {
        lines.push(`DTSTART:${formatIcsDateTime(start)}`);
        lines.push(`DTEND:${formatIcsDateTime(end)}`);
    }

    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push('END:VEVENT');
    return lines.join('\n');
}

function buildCalendar(events) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//OTD E2E//EN',
        ...events,
        'END:VCALENDAR',
    ].join('\n');
}

const today = utcNow();
const selectedYear = today.getUTCFullYear();
const selectedMonth = today.getUTCMonth();
const selectedDay = today.getUTCDate();
const weekStart = new Date(today);
weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay());

const personalDayStart = makeUtcDate(selectedYear - 14, selectedMonth, selectedDay, 10, 0, 0);
const personalWeekStart = addUtcDays(weekStart, 2);
personalWeekStart.setUTCFullYear(selectedYear - 10);
const personalMonthStart = makeUtcDate(
    selectedYear - 12,
    selectedMonth,
    Math.min(selectedDay, 5),
    14,
    0,
    0,
);
const personalYearExcludedStart = makeUtcDate(selectedYear, selectedMonth, selectedDay, 18, 0, 0);
const dayOfMonthMonth = findMonthWithDay(selectedDay, selectedMonth, selectedYear - 2);
const personalDayOfMonthStart = makeUtcDate(
    selectedYear - 2,
    dayOfMonthMonth,
    selectedDay,
    9,
    0,
    0,
);

const cal1 = buildCalendar([
    createEvent({
        uid: 'personal-day-event',
        start: personalDayStart,
        end: addUtcDays(personalDayStart, 0),
        summary: 'Personal Day Event',
        description: 'Day event with https://example.com/day',
    }),
    createEvent({
        uid: 'personal-week-event',
        start: personalWeekStart,
        end: addUtcDays(personalWeekStart, 0),
        summary: 'Personal Week Event',
        description: 'Week event with plain text',
    }),
]);

const cal2 = buildCalendar([
    createEvent({
        uid: 'personal-month-event',
        start: personalMonthStart,
        end: addUtcDays(personalMonthStart, 0),
        summary: 'Personal Month Event',
        description: 'Month event with https://example.com/month',
    }),
    createEvent({
        uid: 'personal-day-of-month-event',
        start: personalDayOfMonthStart,
        end: addUtcDays(personalDayOfMonthStart, 1),
        summary: 'Personal Day of Month Event',
        description: 'Day of month event',
        allDay: true,
    }),
    createEvent({
        uid: 'current-year-excluded-event',
        start: personalYearExcludedStart,
        end: addUtcDays(personalYearExcludedStart, 0),
        summary: 'Current Year Excluded Event',
        description: 'This event should be hidden in day mode',
    }),
]);

const cal2TempPath = path.join(process.env.TMPDIR || '/tmp', 'otd-e2e-cal2.ics');
await writeFile(cal2TempPath, cal2, 'utf8');

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const mockServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === '/cal1.ics') {
        await delay(350);
        res.writeHead(200, {
            'content-type': 'text/calendar; charset=utf-8',
            'cache-control': 'no-store',
        });
        res.end(cal1);
        return;
    }

    if (url.pathname === '/cal2.ics') {
        res.writeHead(200, {
            'content-type': 'text/calendar; charset=utf-8',
            'cache-control': 'no-store',
        });
        res.end(cal2);
        return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
});

const mockPort = await new Promise((resolve, reject) => {
    mockServer.once('error', reject);
    mockServer.listen(0, '127.0.0.1', () => {
        const address = mockServer.address();
        if (!address || typeof address === 'string') {
            reject(new Error('Failed to start mock ICS server'));
            return;
        }
        resolve(address.port);
    });
});

const env = {
    ...process.env,
    HOST: '127.0.0.1',
    APP_ICS_URLS: `http://127.0.0.1:${mockPort}/cal1.ics,${cal2TempPath}`,
    APP_WIKIPEDIA_LANG: 'en',
    APP_WIKIPEDIA_SECTIONS: 'Events,Births',
    NITRO_HOST: '127.0.0.1',
    NITRO_PORT: '4173',
    PORT: '4173',
};

const nuxt = spawn(process.execPath, [nuxtCli, 'dev'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
});

const shutdown = () => {
    nuxt.kill('SIGINT');
    mockServer.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

nuxt.on('exit', (code) => {
    mockServer.close();
    process.exit(code ?? 0);
});
