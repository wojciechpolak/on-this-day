/**
 * server/api/fetch-ics.get.ts
 *
 * On This Day (C) 2024-2025 Wojciech Polak
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

import fs from 'fs/promises';
import path from 'path';

import cache from '../cache';
import logger from '../logger';
import { respondWithIcs } from '../ics-response';
import { useRuntimeConfig } from '#imports';

/**
 * Reads one ICS source, either from a local path or over HTTP.
 */
async function fetchIcsSource(url: string): Promise<string> {
    if (url.startsWith('/') || url.startsWith('./')) {
        const filePath = path.resolve(process.cwd(), url);
        logger.debug('Fetching ICS from local file: %s', filePath);
        return await fs.readFile(filePath, 'utf-8');
    }
    logger.debug('Fetching ICS from %s', url);
    return await $fetch(url, { responseType: 'text' });
}

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const query = getQuery(event);

    const icsUrlsEnv = config.appIcsUrls;
    const cacheTtl = config.appCacheTtl || 86400;

    if (!icsUrlsEnv) {
        const msg = 'Personal calendar source is not configured yet.';
        logger.error(msg);
        throw createError({
            statusCode: 500,
            statusMessage: 'Calendar source not configured',
            message: msg,
        });
    }

    setResponseHeader(event, 'Cache-Control', 'max-age=' + cacheTtl);

    try {
        const icsUrls = icsUrlsEnv.split(',').map((url) => url.trim());
        const cacheKey = 'combinedIcsData' + icsUrls.length;

        // If already in cache, return it
        if (cache.has(cacheKey)) {
            return respondWithIcs(event, query.raw, cache.get(cacheKey) as string);
        }

        // Otherwise fetch from all URLs
        const icsDataArray = await Promise.all(icsUrls.map(fetchIcsSource));
        const combinedData = icsDataArray.join('\n');
        cache.set(cacheKey, combinedData, cacheTtl);

        return respondWithIcs(event, query.raw, combinedData);
    } catch (error) {
        logger.error(error);
        throw createError({
            statusCode: 502,
            statusMessage: 'Calendar source unavailable',
            message: 'Personal calendar source is unavailable right now. Try again later.',
        });
    }
});
