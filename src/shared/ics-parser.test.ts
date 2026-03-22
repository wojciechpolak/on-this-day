/**
 * ics-parser.test.ts
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

import ICalParser from './ics-parser';

describe('ICalParser', () => {
    it('parses UTC and date-only values', () => {
        const parser = new ICalParser('');

        const dateTime = parser.parseDate('20250319T081530Z');
        const dateOnly = parser.parseDate('20250319', false);

        expect(dateTime?.toISOString()).toBe('2025-03-19T08:15:30.000Z');
        expect(dateOnly?.toISOString()).toBe('2025-03-19T00:00:00.000Z');
    });

    it('decodes escaped iCal text and HTML blobs', () => {
        const parser = new ICalParser('');

        expect(parser.unescapeICalString('Line one\\nLine two\\, semicolon\\; slash\\\\')).toBe(
            'Line one\nLine two, semicolon; slash\\',
        );
        expect(
            parser.decodeHtmlBlob('<html-blob>&lt;strong&gt;bold&lt;/strong&gt;</html-blob>'),
        ).toBe('<strong>bold</strong>');
    });

    it('parses VEVENT entries, skips alarms, and handles folded lines', () => {
        const parser = new ICalParser(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T081530Z',
                'DTEND:20250319T091530Z',
                'SUMMARY;VALUE=TEXT:First\\, event',
                'DESCRIPTION:Line one ',
                ' line two',
                'BEGIN:VALARM',
                'ACTION:DISPLAY',
                'DESCRIPTION:Ignored alarm',
                'END:VALARM',
                'END:VEVENT',
                'BEGIN:VEVENT',
                'DTSTART;VALUE=DATE:20250320',
                'DTEND;VALUE=DATE:20250321',
                'SUMMARY:<html-blob>&lt;em&gt;Second&lt;/em&gt;</html-blob>',
                'DESCRIPTION;VALUE=TEXT:Plain\\, text',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const events = parser.getEvents();

        expect(events).toHaveLength(2);

        const firstEvent = events[0];
        const secondEvent = events[1];

        if (!firstEvent || !secondEvent) {
            throw new Error('Expected two parsed events');
        }

        expect(firstEvent.SUMMARY).toBe('First, event');
        expect(firstEvent.DESCRIPTION).toBe('Line one line two');
        expect(firstEvent.DTSTART.toISOString()).toBe('2025-03-19T08:15:30.000Z');
        expect(firstEvent.DTEND.toISOString()).toBe('2025-03-19T09:15:30.000Z');

        expect(secondEvent.SUMMARY).toBe('<em>Second</em>');
        expect(secondEvent.DESCRIPTION).toBe('Plain, text');
        expect(secondEvent.DTSTART.toISOString()).toBe('2025-03-20T00:00:00.000Z');
        expect(secondEvent.DTEND.toISOString()).toBe('2025-03-21T00:00:00.000Z');
        expect(secondEvent.DTSTART_VALUE).toBe('DATE');
        expect(secondEvent.DTEND_VALUE).toBe('DATE');
    });
});
