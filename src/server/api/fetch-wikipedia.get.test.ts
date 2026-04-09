/**
 * fetch-wikipedia.get.test.ts
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    useRuntimeConfig: vi.fn(),
    getQuery: vi.fn(),
    setResponseHeader: vi.fn(),
    createError: vi.fn((message: unknown) => new Error(String(message))),
    cache: {
        has: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
    },
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
    wiki2ics: vi.fn(),
}));

vi.mock('#imports', () => ({
    useRuntimeConfig: mocks.useRuntimeConfig,
}));

vi.mock('../cache', () => ({
    default: mocks.cache,
}));

vi.mock('../logger', () => ({
    default: mocks.logger,
}));

vi.mock('../wiki2ics', () => ({
    default: mocks.wiki2ics,
}));

interface TestEvent {
    node: {
        res: {
            setHeader: ReturnType<typeof vi.fn>;
            end: ReturnType<typeof vi.fn>;
        };
    };
}

function createEvent(): TestEvent {
    return {
        node: {
            res: {
                setHeader: vi.fn(),
                end: vi.fn(),
            },
        },
    };
}

async function loadHandler() {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
    vi.stubGlobal('getQuery', mocks.getQuery);
    vi.stubGlobal('setResponseHeader', mocks.setResponseHeader);
    vi.stubGlobal('createError', mocks.createError);
    return await import('./fetch-wikipedia.get');
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe('fetch-wikipedia.get', () => {
    it('fetches, caches, parses, and sorts wikipedia events', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 3600,
            appWikipediaSections: 'Events,Births',
            appWikipediaLangEnforce: true,
            appWikipediaLang: 'pl',
        });
        mocks.getQuery.mockReturnValue({
            date: '2025-03-19',
            lang: 'en',
        });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250318T000000Z',
                'DTEND:20250318T000000Z',
                'SUMMARY:Events: Earlier',
                'DESCRIPTION:Earlier',
                'END:VEVENT',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:Births: Later',
                'DESCRIPTION:Later',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        const result = await handler(event);

        expect(mocks.setResponseHeader).toHaveBeenCalledWith(
            event,
            'Cache-Control',
            'max-age=3600',
        );
        expect(mocks.wiki2ics).toHaveBeenCalledWith('2025-03-19', ['Events', 'Births'], 'pl');
        expect(mocks.cache.set).toHaveBeenCalledWith(
            'wikipediaData-pl-2025-03-19',
            expect.any(String),
            3600,
        );
        expect(result).toHaveLength(2);

        const summaries = result.map((item) => item.SUMMARY);
        expect(summaries).toEqual(['Births: Later', 'Events: Earlier']);
    });

    it('returns cached raw ICS when requested', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 120,
            appWikipediaSections: 'Events,Births',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({
            date: '2025-03-19',
            raw: '1',
            lang: 'en',
        });
        mocks.cache.has.mockReturnValue(true);
        mocks.cache.get.mockReturnValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:Cached',
                'DESCRIPTION:Cached',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar');
        expect(event.node.res.end).toHaveBeenCalledWith(expect.stringContaining('SUMMARY:Cached'));
        expect(mocks.wiki2ics).not.toHaveBeenCalled();
    });

    it('parses and returns cached events when no raw param is given', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 120,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', lang: 'en' });
        mocks.cache.has.mockReturnValue(true);
        mocks.cache.get.mockReturnValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:CachedWiki',
                'DESCRIPTION:Wiki cache',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        const result = await handler(event);

        expect(result).toHaveLength(1);
        expect(result[0].SUMMARY).toBe('CachedWiki');
        expect(mocks.wiki2ics).not.toHaveBeenCalled();
    });

    it('returns raw ICS after a fresh fetch when raw param is set', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', raw: '1', lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:FreshWikiRaw',
                'DESCRIPTION:Fresh',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar');
        expect(event.node.res.end).toHaveBeenCalledWith(
            expect.stringContaining('SUMMARY:FreshWikiRaw'),
        );
    });

    it('falls back to 86400s TTL when appCacheTtl is not configured', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 0, // falsy → fallback
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(mocks.setResponseHeader).toHaveBeenCalledWith(
            event,
            'Cache-Control',
            'max-age=86400',
        );
        expect(mocks.cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 86400);
    });

    it('passes empty sectionTitles when appWikipediaSections is not set', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: '', // falsy → empty array passed to wiki2ics
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(mocks.wiki2ics).toHaveBeenCalledWith('2025-03-19', [], 'en');
    });

    it('uses a date array element when date query param is an array', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: ['2025-03-19', '2025-03-20'], lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(mocks.wiki2ics).toHaveBeenCalledWith('2025-03-19', expect.any(Array), 'en');
    });

    it('throws and logs on wiki2ics error', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockRejectedValue(new Error('Wikipedia down'));

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await expect(handler(event)).rejects.toThrow();
        expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('uses fallback error message when catch receives a falsy error', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        mocks.getQuery.mockReturnValue({ date: '2025-03-19', lang: 'en' });
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockRejectedValue(null);

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await expect(handler(event)).rejects.toThrow('Error fetching Wikipedia data');
    });

    it('falls back to empty date string and "en" lang when both are absent from query', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appCacheTtl: 60,
            appWikipediaSections: 'Events',
            appWikipediaLangEnforce: false,
            appWikipediaLang: 'en',
        });
        // date is undefined (not an array), lang is undefined → triggers ?? '' and || 'en'
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(false);
        mocks.wiki2ics.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await handler(event);

        expect(mocks.wiki2ics).toHaveBeenCalledWith('', expect.any(Array), 'en');
    });
});
