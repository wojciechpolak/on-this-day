/**
 * app.mjs
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

/*global process */

import express from 'express';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import ICalParser from './ics-parser.mjs';
import logger from './logger.mjs';
import wiki2ics from './wiki2ics.mjs';

dotenv.config();

const __dirname = import.meta.dirname;
const app = express();
const port = process.env.APP_PORT ?? 3000;
const cache = new NodeCache({stdTTL: process.env.APP_CACHE_TTL ?? 86400});

app.use(express.static('src/public')); // Serve static files from the 'public' directory

app.get('/fetch-ics', async (req, res) => {
    if (!process.env.APP_ICS_URLS) {
        logger.error('Env APP_ICS_URLS not specified');
        return res.status(500).send('Error fetching ICS data');
    }
    try {
        const icsUrls = process.env.APP_ICS_URLS.split(',').map(url => url.trim());
        const cacheKey = 'combinedIcsData';

        // Check if the data is already in cache
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            if (req.query.raw) {
                return res.type('text/calendar').send(cachedData);
            }
            const parser = new ICalParser(cachedData);
            return res.send(parser.getEvents());
        }

        // Fetch data from all URLs if not in cache
        const icsDataArray = await Promise.all(icsUrls.map(async (url) => {
            if (url.startsWith('/') || url.startsWith('./')) {
                const filePath = path.resolve(__dirname, url);
                logger.debug('Fetching ICS from local file: %s', filePath);
                return await fs.readFile(filePath, 'utf-8');
            }
            else {
                logger.debug('Fetching ICS from %s', url);
                const response = await fetch(url);
                return await response.text();
            }
        }));

        // Combine all the ICS data into one string
        const combinedData = icsDataArray.join('\n');

        // Store the combined data in cache
        cache.set(cacheKey, combinedData);

        if (req.query.raw) {
            return res.type('text/calendar').send(combinedData);
        }

        // Parse ICS
        const parser = new ICalParser(combinedData);
        const events = parser.getEvents();

        res.send(events);
    }
    catch (error) {
        logger.error(error);
        res.status(500).send('Error fetching ICS data');
    }
});

app.get('/fetch-wikipedia', async (req, res) => {
    const dateParam = req.query.date; // Expected in 'YYYY-MM-DD' format
    let lang = req.query.lang || 'en';

    if (process.env.APP_WIKIPEDIA_LANG_ENFORCE) {
        lang = process.env.APP_WIKIPEDIA_LANG || 'en';
    }

    try {
        const cacheKey = `wikipediaData-${lang}-${dateParam}`;
        const wikipediaSections = process.env.APP_WIKIPEDIA_SECTIONS;

        // Check if the data is already in cache
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            if (req.query.raw) {
                return res.type('text/calendar').send(cachedData);
            }
            const parser = new ICalParser(cachedData);
            return res.send(parser.getEvents());
        }

        let sectionTitles = undefined;
        if (wikipediaSections) {
            sectionTitles = wikipediaSections.split(',');
        }
        const wikiData = await wiki2ics(dateParam, sectionTitles, lang);

        cache.set(cacheKey, wikiData);

        if (req.query.raw) {
            return res.type('text/calendar').send(wikiData);
        }

        // Parse ICS
        const parser = new ICalParser(wikiData);
        const events = parser.getEvents();
        res.send(events);
    }
    catch (error) {
        logger.error(error);
        res.status(500).send('Error fetching Wikipedia data');
    }
});

const server = app.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
});

function shutDown() {
    server.close(() => {
        logger.info('Server closed')
    })
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
