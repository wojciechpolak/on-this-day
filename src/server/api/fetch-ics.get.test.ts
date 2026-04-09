/**
 * fetch-ics.get.test.ts
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
    readFile: vi.fn(),
    remoteFetch: vi.fn(),
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

vi.mock('fs/promises', () => ({
    default: {
        readFile: mocks.readFile,
    },
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
    vi.stubGlobal('$fetch', mocks.remoteFetch);
    return await import('./fetch-ics.get');
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe('fetch-ics.get', () => {
    it('combines local and remote ICS sources, caches, parses, and sorts events', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: './fixtures/local.ics,https://example.com/remote.ics',
            appCacheTtl: 900,
        });
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(false);
        mocks.readFile.mockResolvedValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250318T000000Z',
                'DTEND:20250318T000000Z',
                'SUMMARY:Local',
                'DESCRIPTION:Local',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );
        mocks.remoteFetch.mockResolvedValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:Remote',
                'DESCRIPTION:Remote',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        const result = await handler(event);

        expect(mocks.setResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'max-age=900');
        expect(mocks.readFile).toHaveBeenCalledTimes(1);
        expect(mocks.remoteFetch).toHaveBeenCalledWith('https://example.com/remote.ics', {
            responseType: 'text',
        });
        expect(mocks.cache.set).toHaveBeenCalledWith(
            'combinedIcsData2',
            expect.stringContaining('SUMMARY:Local'),
            900,
        );
        expect(result).toHaveLength(2);
        expect(result.map((item) => item.SUMMARY)).toEqual(['Remote', 'Local']);
    });

    it('returns cached raw ICS when requested', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: './fixtures/local.ics,https://example.com/remote.ics',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({ raw: '1' });
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
        expect(mocks.readFile).not.toHaveBeenCalled();
        expect(mocks.remoteFetch).not.toHaveBeenCalled();
    });

    it('parses and returns cached events when no raw param is given', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: './fixtures/local.ics',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(true);
        mocks.cache.get.mockReturnValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:CachedEvent',
                'DESCRIPTION:From cache',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\n'),
        );

        const { default: handler } = await loadHandler();
        const event = createEvent();

        const result = await handler(event);

        expect(result).toHaveLength(1);
        expect(result[0].SUMMARY).toBe('CachedEvent');
        expect(mocks.readFile).not.toHaveBeenCalled();
        expect(mocks.remoteFetch).not.toHaveBeenCalled();
    });

    it('returns raw ICS after a fresh fetch when raw param is set', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: 'https://example.com/remote.ics',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({ raw: '1' });
        mocks.cache.has.mockReturnValue(false);
        mocks.remoteFetch.mockResolvedValue(
            [
                'BEGIN:VCALENDAR',
                'BEGIN:VEVENT',
                'DTSTART:20250319T000000Z',
                'DTEND:20250319T000000Z',
                'SUMMARY:FreshRaw',
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
            expect.stringContaining('SUMMARY:FreshRaw'),
        );
    });

    it('falls back to 86400s TTL when appCacheTtl is not configured', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: 'https://example.com/remote.ics',
            appCacheTtl: 0, // falsy → should fall back to 86400
        });
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(false);
        mocks.remoteFetch.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

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

    it('throws when APP_ICS_URLS is not configured', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: '',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({});

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await expect(handler(event)).rejects.toThrow();
        expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('throws and logs on fetch error', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: 'https://example.com/remote.ics',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(false);
        mocks.remoteFetch.mockRejectedValue(new Error('Network error'));

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await expect(handler(event)).rejects.toThrow();
        expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('uses the fallback error message when catch receives a falsy error', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            appIcsUrls: 'https://example.com/remote.ics',
            appCacheTtl: 60,
        });
        mocks.getQuery.mockReturnValue({});
        mocks.cache.has.mockReturnValue(false);
        // Reject with null (falsy) → triggers `error || 'Error fetching ICS data'`
        mocks.remoteFetch.mockRejectedValue(null);

        const { default: handler } = await loadHandler();
        const event = createEvent();

        await expect(handler(event)).rejects.toThrow('Error fetching ICS data');
    });
});
