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

import ICalParser from '~/server/ics-parser';
import cache from '~/server/cache';
import logger from '~/server/logger';
import { sortEvents } from '~/utils/helpers';
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const query = getQuery(event);

    const icsUrlsEnv = config.appIcsUrls;
    const cacheTtl = config.appCacheTtl || 86400;

    if (!icsUrlsEnv) {
        const msg = 'Env APP_ICS_URLS not specified';
        logger.error(msg);
        throw createError(msg);
    }

    setResponseHeader(event, 'Cache-Control', 'max-age=' + cacheTtl);

    try {
        const icsUrls = icsUrlsEnv.split(',').map((url) => url.trim());
        const cacheKey = 'combinedIcsData' + icsUrls.length;

        // If already in cache, return it
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey) as string;
            if (query.raw) {
                event.node.res.setHeader('Content-Type', 'text/calendar');
                return event.node.res.end(cachedData);
            }
            const parser = new ICalParser(cachedData);
            return parser
                .getEvents()
                .sort(sortEvents);
        }

        // Otherwise fetch from all URLs
        const icsDataArray = await Promise.all(
            icsUrls.map(async (url: string) => {
                if (url.startsWith('/') || url.startsWith('./')) {
                    const filePath = path.resolve(process.cwd(), url);
                    logger.debug('Fetching ICS from local file: %s', filePath);
                    return await fs.readFile(filePath, 'utf-8');
                }
                else {
                    logger.debug('Fetching ICS from %s', url);
                    return await $fetch(url, {responseType: 'text'});
                }
            }),
        );

        const combinedData = icsDataArray.join('\n');
        cache.set(cacheKey, combinedData, cacheTtl);

        if (query.raw) {
            event.node.res.setHeader('Content-Type', 'text/calendar');
            return event.node.res.end(combinedData);
        }

        const parser = new ICalParser(combinedData);
        return parser
            .getEvents()
            .sort(sortEvents);
    }
    catch (error) {
        logger.error(error);
        throw createError(error || 'Error fetching ICS data');
    }
});
