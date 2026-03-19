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
});
