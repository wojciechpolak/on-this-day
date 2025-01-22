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

import NodeCache from 'node-cache';
import { useRuntimeConfig } from '#imports';

import ICalParser from '~/server/ics-parser';
import logger from '~/server/logger';
import wiki2ics from '~/server/wiki2ics';
import { sortEvents } from '~/utils/helpers';

const cache = new NodeCache();

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    // 'YYYY-MM-DD'
    const dateParam: string = Array.isArray(query.date) ?
        query.date[0] :
        query.date ?? '';
    let lang: string = <string>query.lang || 'en';

    const config = useRuntimeConfig();
    const cacheTtl = config.appCacheTtl || 86400;
    const enforceLang = config.appWikipediaLangEnforce;
    const forcedLang = config.appWikipediaLang;

    if (enforceLang) {
        lang = forcedLang;
    }

    setResponseHeader(event, 'Cache-Control', 'max-age=' + cacheTtl);

    try {
        const cacheKey = `wikipediaData-${lang}-${dateParam}`;
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

        const wikipediaSections = config.appWikipediaSections; // e.g. 'Events,Births,Deaths'
        let sectionTitles: string[] = [];
        if (wikipediaSections) {
            sectionTitles = wikipediaSections.split(',');
        }

        const wikiData = await wiki2ics(dateParam, sectionTitles, lang);
        cache.set(cacheKey, wikiData, cacheTtl);

        if (query.raw) {
            event.node.res.setHeader('Content-Type', 'text/calendar');
            return event.node.res.end(wikiData);
        }

        const parser = new ICalParser(wikiData);
        return parser
            .getEvents()
            .sort(sortEvents);
    }
    catch (error) {
        logger.error(error);
        return 'Error fetching Wikipedia data';
    }
});
