/**
 * wiki2ics.integration.test.ts
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const createEvent = vi.fn();
  const toString = vi.fn(() => 'ICS-DATA');

  return {
    fetch: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
    createEvent,
    toString,
    icalFactory: vi.fn(() => ({
      createEvent,
      toString,
    })),
  };
});

vi.mock('ical-generator', () => ({
  default: mocks.icalFactory,
}));

vi.mock('./logger', () => ({
  default: mocks.logger,
}));

async function loadWiki2ics() {
  return await import('./wiki2ics');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('$fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wiki2ics', () => {
  it('rejects invalid ISO dates', async () => {
    const { default: wiki2ics } = await loadWiki2ics();

    await expect(wiki2ics('invalid-date', [], 'en')).rejects.toThrow(
      'Invalid date format. Please use ISO format (YYYY-MM-DD).',
    );
  });

  it('builds ICS from wikipedia sections and skips BCE events', async () => {
    mocks.fetch
      .mockResolvedValueOnce({
        parse: {
          pageid: 1,
          sections: [
            {
              anchor: 'Events',
              byteoffset: 0,
              fromtitle: 'March 19',
              index: '1',
              level: '2',
              line: 'Events',
              linkAnchor: 'Events',
              number: '1',
              toclevel: 2,
            },
          ],
          showtoc: '',
          text: { '*': '' },
          title: 'March 19',
        },
      })
      .mockResolvedValueOnce({
        parse: {
          pageid: 1,
          sections: [],
          showtoc: '',
          text: {
            '*': [
              '<ul>',
              '<li>1096 BC – <a href="/wiki/Skip_me">Skip me</a></li>',
              '<li>2001 – <span><a href="/wiki/Keep_me">Keep me</a></span></li>',
              '</ul>',
            ].join(''),
          },
          title: 'March 19',
        },
      });

    const { default: wiki2ics } = await loadWiki2ics();
    const result = await wiki2ics('2025-03-19', [], 'en');

    expect(result).toBe('ICS-DATA');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Events: Keep me',
        description: expect.objectContaining({
          plain: 'Keep me',
        }),
      }),
    );
  });

  it('returns an empty string when no matching wikipedia sections are found', async () => {
    mocks.fetch.mockResolvedValueOnce({
      parse: {
        pageid: 1,
        sections: [],
        showtoc: '',
        text: { '*': '' },
        title: 'March 19',
      },
    });

    const { default: wiki2ics } = await loadWiki2ics();
    const result = await wiki2ics('2025-03-19', ['Events'], 'en');

    expect(result).toBe('');
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
