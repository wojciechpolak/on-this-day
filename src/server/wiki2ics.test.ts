/**
 * wiki2ics.test.ts
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

import { describe, expect, it } from 'vitest';

import { createDate, extractEventsFromContent, getSectionTitles } from './wiki2ics';

describe('getSectionTitles', () => {
    it('returns localized section titles and falls back to English', () => {
        expect(getSectionTitles('pl')).toEqual([
            'Wydarzenia w Polsce',
            'Wydarzenia na świecie',
            'Urodzili się',
            'Zmarli',
        ]);
        expect(getSectionTitles('xx')).toEqual(['Events', 'Births', 'Deaths']);
    });
});

describe('createDate', () => {
    it('creates a UTC date from year, month, and day', () => {
        const date = createDate(2025, 3, 19);

        if (!date) {
            throw new Error('Expected a date');
        }

        expect(date.toISOString()).toBe('2025-03-19T00:00:00.000Z');
    });
});

describe('extractEventsFromContent', () => {
    it('rewrites links, unwraps markup, and extracts dated items', () => {
        const events = extractEventsFromContent(
            [
                '<ul>',
                '<li>1096 – <span><a href="/wiki/First_event">First event</a></span> and ',
                '<a href="#History">history</a><sup>[1]</sup></li>',
                '<li>Not a dated item</li>',
                '</ul>',
            ].join(''),
            'January 1',
            'en',
        );

        expect(events).toHaveLength(1);

        const event = events[0];
        if (!event) {
            throw new Error('Expected one extracted event');
        }

        expect(event.text).toBe('1096 – First event and history');
        expect(event.html).toContain('https://en.wikipedia.org/wiki/First_event');
        expect(event.html).toContain('https://en.wikipedia.org/wiki/January%201#History');
        expect(event.html).not.toContain('<sup>');
    });

    it('supports colon-based date prefixes for non-English languages', () => {
        const events = extractEventsFromContent(
            '<ul><li>2001: <a href="https://example.com">Example</a></li></ul>',
            '1 de enero',
            'es',
        );

        expect(events).toHaveLength(1);
        expect(events[0]?.text).toBe('2001: Example');
    });
});
