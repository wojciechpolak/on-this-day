/**
 * helpers.test.ts
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

import { parseInputText, sortEvents } from './helpers';
import type { IcsEvent } from './ics-parser';

describe('sortEvents', () => {
    it('sorts events by DTSTART descending and falls back to DTEND', () => {
        const events: IcsEvent[] = [
            {
                DTSTART: new Date('2024-01-01T00:00:00.000Z'),
                DTEND: new Date('2024-01-01T01:00:00.000Z'),
                SUMMARY: 'older',
                DESCRIPTION: '',
            },
            {
                DTSTART: new Date('2025-01-01T00:00:00.000Z'),
                DTEND: new Date('2025-01-01T01:00:00.000Z'),
                SUMMARY: 'newer',
                DESCRIPTION: '',
            },
            {
                DTSTART: new Date('2023-01-01T00:00:00.000Z'),
                DTEND: new Date('2026-01-01T00:00:00.000Z'),
                SUMMARY: 'fallback',
                DESCRIPTION: '',
            },
        ];

        expect([...events].sort(sortEvents).map((event) => event.SUMMARY)).toEqual([
            'newer',
            'older',
            'fallback',
        ]);
    });

    it('falls back to DTEND when DTSTART is epoch (valueOf === 0)', () => {
        const events: IcsEvent[] = [
            {
                DTSTART: new Date(0),
                DTEND: new Date('2020-01-01T00:00:00.000Z'),
                SUMMARY: 'epoch-start',
                DESCRIPTION: '',
            },
            {
                DTSTART: new Date('2019-01-01T00:00:00.000Z'),
                DTEND: new Date('2019-01-01T01:00:00.000Z'),
                SUMMARY: 'regular',
                DESCRIPTION: '',
            },
        ];

        // epoch-start has DTSTART=0 (falsy), so DTEND=2020 is used; regular has DTSTART=2019
        expect([...events].sort(sortEvents).map((e) => e.SUMMARY)).toEqual([
            'epoch-start',
            'regular',
        ]);
    });

    it('falls back to DTEND on the a-side when a.DTSTART is epoch', () => {
        const events: IcsEvent[] = [
            {
                DTSTART: new Date('2021-06-01T00:00:00.000Z'),
                DTEND: new Date('2021-06-01T01:00:00.000Z'),
                SUMMARY: 'normal',
                DESCRIPTION: '',
            },
            {
                DTSTART: new Date(0),
                DTEND: new Date('2018-01-01T00:00:00.000Z'),
                SUMMARY: 'a-epoch',
                DESCRIPTION: '',
            },
        ];

        // normal: DTSTART=2021; a-epoch: DTSTART=0 → falls back to DTEND=2018
        expect([...events].sort(sortEvents).map((e) => e.SUMMARY)).toEqual(['normal', 'a-epoch']);
    });
});

describe('parseInputText', () => {
    it('escapes HTML, linkifies URLs, and converts newlines to <br>', () => {
        const result = parseInputText('Hello <b>world</b>\nVisit https://example.com/path');

        expect(result).toBe(
            'Hello &lt;b&gt;world&lt;/b&gt;<br>Visit ' +
                '<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">' +
                'https://example.com/path</a>',
        );
    });

    it('escapes apostrophes and ampersands before linkification', () => {
        const result = parseInputText("Rock & Roll's https://example.com");

        expect(result).toContain('Rock &amp; Roll&#039;s ');
        expect(result).toContain(
            '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
        );
    });

    it('linkifies URLs with query params without swallowing trailing punctuation', () => {
        const result = parseInputText(
            '(https://example.com/tools/duration?d1=29&m1=10&y1=2005&d2=8&m2=2&y2=2023&ti=on)\nhttps://example.com/albums/sample-gallery',
        );

        expect(result).toContain(
            '(<a href="https://example.com/tools/duration?d1=29&amp;m1=10&amp;y1=2005&amp;d2=8&amp;m2=2&amp;y2=2023&amp;ti=on" target="_blank" rel="noopener noreferrer">https://example.com/tools/duration?d1=29&amp;m1=10&amp;y1=2005&amp;d2=8&amp;m2=2&amp;y2=2023&amp;ti=on</a>)',
        );
        expect(result).toContain(
            '<a href="https://example.com/albums/sample-gallery" target="_blank" rel="noopener noreferrer">https://example.com/albums/sample-gallery</a>',
        );
        expect(result).not.toContain('&amp;amp;');
    });
});
