/**
 * server/api/fetch-wikipedia.get.ts
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

import { useRuntimeConfig } from '#imports';

import cache from '../cache';
import logger from '../logger';
import wiki2ics from '../wiki2ics';
import { respondWithIcs } from '../ics-response';

/**
 * Reads a single query parameter, taking the first entry when it is repeated.
 */
function firstQueryValue(value: unknown): string {
    if (Array.isArray(value)) {
        return <string>value[0] ?? '';
    }
    return <string>value ?? '';
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const dateParam: string = firstQueryValue(query.date); // 'YYYY-MM-DD'

    const config = useRuntimeConfig();
    const cacheTtl = config.appCacheTtl || 86400;
    const lang: string = config.appWikipediaLangEnforce
        ? config.appWikipediaLang
        : firstQueryValue(query.lang) || 'en';

    setResponseHeader(event, 'Cache-Control', 'max-age=' + cacheTtl);

    try {
        const cacheKey = `wikipediaData-${lang}-${dateParam}`;
        if (cache.has(cacheKey)) {
            return respondWithIcs(event, query.raw, cache.get(cacheKey) as string);
        }

        // e.g. 'Events,Births,Deaths'
        const wikipediaSections: string | undefined = config.appWikipediaSections;
        const sectionTitles = wikipediaSections ? wikipediaSections.split(',') : [];

        const wikiData = await wiki2ics(dateParam, sectionTitles, lang);
        cache.set(cacheKey, wikiData, cacheTtl);

        return respondWithIcs(event, query.raw, wikiData);
    } catch (error) {
        logger.error(error);
        throw createError(error || 'Error fetching Wikipedia data');
    }
});
