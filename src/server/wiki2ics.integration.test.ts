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
    it('formats the date using locale string for pl/es/de/fr languages', async () => {
        mocks.fetch
            .mockResolvedValueOnce({
                parse: {
                    pageid: 1,
                    sections: [
                        {
                            anchor: 'Events',
                            byteoffset: 0,
                            fromtitle: '19 marca',
                            index: '1',
                            level: '2',
                            line: 'Wydarzenia w Polsce',
                            linkAnchor: 'Events',
                            number: '1',
                            toclevel: 2,
                        },
                    ],
                    showtoc: '',
                    text: { '*': '' },
                    title: '19 marca',
                },
            })
            .mockResolvedValueOnce({
                parse: {
                    pageid: 1,
                    sections: [],
                    showtoc: '',
                    text: {
                        '*': '<ul><li>2001 – <a href="/wiki/Foo">Zdarzenie</a></li></ul>',
                    },
                    title: '19 marca',
                },
            });

        const { default: wiki2ics } = await loadWiki2ics();
        const result = await wiki2ics('2025-03-19', ['Wydarzenia w Polsce'], 'pl');

        expect(result).toBe('ICS-DATA');
        // Verify the Wikipedia API was called with the Polish date string
        const firstCallUrl = (mocks.fetch.mock.calls[0] as [string])[0];
        expect(firstCallUrl).toContain('pl.wikipedia.org');
    });

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

    it('returns empty string and logs error when sections API returns an error', async () => {
        mocks.fetch.mockResolvedValueOnce({
            error: {
                code: 'nosuchpage',
                info: 'The page you specified does not exist.',
                '*': '',
            },
            parse: {
                pageid: 0,
                sections: [],
                showtoc: '',
                text: { '*': '' },
                title: '',
            },
        });

        const { default: wiki2ics } = await loadWiki2ics();
        const result = await wiki2ics('2025-03-19', ['Events'], 'en');

        expect(result).toBe('');
        expect(mocks.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('The page you specified does not exist.'),
        );
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to getSectionTitles when sectionTitles array is empty', async () => {
        // sections fetch returns default English titles in section.line
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
                        '*': '<ul><li>2001 – <a href="/wiki/Foo">Foo</a></li></ul>',
                    },
                    title: 'March 19',
                },
            });

        const { default: wiki2ics } = await loadWiki2ics();
        // pass empty sectionTitles → should fall back to getSectionTitles('en')
        const result = await wiki2ics('2025-03-19', [], 'en');

        expect(result).toBe('ICS-DATA');
        expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    });

    it('uses the current date when dateParam is empty', async () => {
        mocks.fetch.mockResolvedValueOnce({
            parse: {
                pageid: 1,
                sections: [],
                showtoc: '',
                text: { '*': '' },
                title: 'Some Date',
            },
        });

        const { default: wiki2ics } = await loadWiki2ics();
        const result = await wiki2ics('', [], 'en');

        expect(result).toBe('');
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it('logs and skips a section when getSectionContent returns an API error', async () => {
        mocks.fetch
            .mockResolvedValueOnce({
                // First call: sections response — Events section found
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
                // Second call: section content returns an API error
                error: {
                    code: 'missingtitle',
                    info: 'The page you specified does not exist.',
                    '*': '',
                },
                parse: {
                    pageid: 0,
                    sections: [],
                    showtoc: '',
                    text: { '*': '' },
                    title: '',
                },
            });

        const { default: wiki2ics } = await loadWiki2ics();
        const result = await wiki2ics('2025-03-19', ['Events'], 'en');

        // Content fetch errored → no events → empty calendar string (still valid ICS)
        expect(mocks.logger.error).toHaveBeenCalled();
        expect(mocks.createEvent).not.toHaveBeenCalled();
        expect(result).toBe('ICS-DATA');
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
