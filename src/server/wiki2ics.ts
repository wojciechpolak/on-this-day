/**
 * wiki2ics.ts
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

import ical from 'ical-generator';
import { DateTime } from 'luxon';
import logger from './logger';
import * as cheerio from 'cheerio';

const wikiExtractor: Record<string, RegExp> = {
    en: new RegExp('^(\\d+)(\\s*BC)?\\s*–\\s*(.*)'),
    pl: new RegExp('^(\\d+)(\\s*BC)?\\s*–\\s*(.*)'),
    es: new RegExp('^(\\d+)(\\s*BC)?\\s*:\\s*(.*)'),
    de: new RegExp('^(\\d+)(\\s*BC)?\\s*:\\s*(.*)'),
    fr: new RegExp('^(\\d+)(\\s*BC)?\\s*:\\s*(.*)'),
};

interface WikiSection {
    anchor: string;
    byteoffset: number;
    fromtitle: string;
    index: string;
    level: string;
    line: string;
    linkAnchor: string;
    number: string;
    toclevel: number;
}

interface WikiSectionsResponse {
    parse: {
        pageid: number;
        sections: WikiSection[];
        showtoc: string;
        text: {
            '*': string;
        };
        title: string;
    },
    error?: {
        code: string;
        info: string;
        '*': string;
    };
}

interface WikiEvent {
    html: string;
    text: string;
}

/**
 * Fetches Wikipedia's On This Day events and converts them to ICS
 */
async function wiki2ics(dateParam: string, sectionTitles: string[], lang='en'): Promise<string> {

    // Parse the date parameter or use the current date
    let dateObj;
    if (dateParam) {
        dateObj = DateTime.fromISO(dateParam, {zone: 'utc'});
        if (!dateObj.isValid) {
            throw new Error('Invalid date format. Please use ISO format (YYYY-MM-DD).');
        }
    }
    else {
        dateObj = DateTime.local();
    }

    sectionTitles = sectionTitles.length && sectionTitles || getSectionTitles(lang);
    logger.debug('sectionTitles: %s', sectionTitles);

    let dateStr;
    // Format the date into the Wikipedia page title format, considering localization
    if (lang === 'pl' || lang === 'es' || lang === 'de' || lang === 'fr') {
        dateStr = dateObj
            .setLocale(lang)
            .toLocaleString({
                day: 'numeric',
                month: 'long',
            }); // e.g. '1 lipca'
    }
    else {
        const localizedMonth = dateObj
            .setLocale(lang)
            .toFormat('LLLL'); // Full month name
        const localizedDay = dateObj
            .setLocale(lang)
            .toFormat('d'); // Day of the month
        dateStr = `${localizedMonth} ${localizedDay}`; // e.g. 'October 21'
    }

    // Get current date
    const month = dateObj.month;
    const day = dateObj.day;

    logger.info(`Fetching Wikipedia events for ${dateStr} in language ${lang}`);

    // Wikipedia API URLs
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;

    // Fetch section indexes
    const sectionIndexes = await getSectionIndexes(apiUrl, dateStr, sectionTitles);
    if (Object.keys(sectionIndexes).length === 0) {
        logger.error('Failed to retrieve section indexes.');
        return '';
    }

    // Fetch and parse events
    const allEvents: Record<string, WikiEvent[]> = {};
    for (const sectionTitle of sectionTitles) {
        if (!(sectionTitle in sectionIndexes)) {
            logger.info(`Section '${sectionTitle}' not found.`);
            allEvents[sectionTitle] = [];
            continue;
        }
        const sectionIndex = sectionIndexes[sectionTitle];
        const content = await getSectionContent(apiUrl, dateStr, sectionIndex);
        const events = extractEventsFromContent(content, dateStr, lang);
        logger.debug(`Extracted ${events.length} events from section ${sectionTitle}`);
        allEvents[sectionTitle] = events;
    }

    // Generate ICS data
    const cal = ical({name: `Events on ${dateStr}`});

    for (const [section, events] of Object.entries(allEvents)) {
        for (const event of events) {
            const eventText = event.text;
            const eventHtml = event.html;

            // Match patterns like '1096 – Event description' or
            // '1096 BC – Event description'
            const match = eventText.match(wikiExtractor[lang] || wikiExtractor['en']);
            let descriptionText;
            const descriptionHtml = eventHtml;
            let eventYear;
            if (match) {
                const yearStr = match[1];
                const bc = match[2];
                descriptionText = match[3] || '';
                // Clean description
                descriptionText = descriptionText
                    .replace(/\s+([.,])/g, '$1')
                    .replace(/\s+/g, ' ').trim();
                const year = parseInt(yearStr, 10);
                if (bc) {
                    // BCE date handling
                    // Skip BCE events
                    continue;
                }
                else {
                    eventYear = year;
                }
            }
            else {
                // No year found; skip the event
                continue;
            }

            const eventDate = createDate(eventYear, month, day);
            if (!eventDate) {
                // Invalid date; skip the event
                continue;
            }

            // Add event to calendar
            cal.createEvent({
                start: eventDate,
                end: eventDate,
                summary: `${section}: ${descriptionText}`,
                description: {
                    plain: descriptionText,
                    html: descriptionHtml,
                },
                id: generateUID(),
            });
        }
    }

    // Return ICS data as string
    return cal.toString();
}

/**
 * Generates UID
 * @returns {string}
 */
function generateUID(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Gets translated section titles
 */
function getSectionTitles(lang='en'): string[] {
    const titles: Record<string, string[]> = {
        en: [
            'Events',
            'Births',
            'Deaths'
        ],
        pl: [
            'Wydarzenia w Polsce',
            'Wydarzenia na świecie',
            'Urodzili się',
            'Zmarli'
        ],
        es: [
            'Acontecimientos',
            'Nacimientos',
            'Fallecimientos',
        ],
        de: [
            'Ereignisse',
            'Geboren',
            'Gestorben',
        ],
        fr: [
            'Événements',
            'Naissances',
            'Décès',
        ],
    };
    return titles[lang] || titles['en'];
}

/**
 * Gets section indexes
 */
async function getSectionIndexes(apiUrl: string, title: string,
                                 sectionTitles: string[]): Promise<Record<string, string>> {
    const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'sections',
        format: 'json',
    });

    const data: WikiSectionsResponse = await $fetch(`${apiUrl}?${params}`, {responseType: 'json'});

    if (data.error) {
        logger.error(`Error fetching sections: ${data.error.info}`);
        return {};
    }

    const sections = data.parse.sections;
    const sectionIndexes: Record<string, string> = {};

    for (const section of sections) {
        if (sectionTitles.includes(section.line.trim())) {
            sectionIndexes[section.line.trim()] = section.index;
        }
    }

    return sectionIndexes;
}

/**
 * Gets section content
 */
async function getSectionContent(apiUrl: string, title: string,
                                 sectionIndex: string): Promise<string> {
    const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'text',
        section: sectionIndex,
        format: 'json',
    });

    const data: WikiSectionsResponse = await $fetch(`${apiUrl}?${params}`, {responseType: 'json'});

    if (data.error) {
        logger.error(`Error fetching section content: ${data.error.info}`);
        return '';
    }

    return data.parse.text['*'];
}

/**
 * Extracts events from content
 */
function extractEventsFromContent(content: string, title: string, lang: string): WikiEvent[] {
    const $ = cheerio.load(content);
    const events: WikiEvent[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $('li').each((_i: number, elem: any) => {
        // Remove all <sup> elements within this <li>
        $(elem).find('sup').remove();

        // Process all <a> tags to include full URLs
        $(elem).find('a').each((_i, link) => {
            const $link = $(link);
            const href: string = $link.attr('href') as string;

            // Build the full URL
            let fullUrl = href;
            if (href.startsWith('/')) {
                fullUrl = `https://${lang}.wikipedia.org${href}`;
            }
            else if (href.startsWith('#')) {
                fullUrl = `https://${lang}.wikipedia.org/wiki/` + encodeURIComponent(title) + href;
            }
            else if (href.startsWith('http')) {
                // fullUrl is already complete
            }
            else {
                fullUrl = `https://${lang}.wikipedia.org/wiki/${href}`;
            }

            // Update the href attribute to the full URL
            $link
                .attr('href', fullUrl)
                .attr('rel', 'noreferrer')
                .attr('target', '_blank');
        });

        // Remove all tags except <a> by unwrapping them
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unwrapElements($ as any, elem);

        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        const htmlContent = $(elem).html() as string;

        // Check if text starts with a year and an en dash
        if ((wikiExtractor[lang] || wikiExtractor['en']).test(text)) {
            // Remove extra spaces before punctuation
            const cleanedText = text
                .replace(/\s+([.,])/g, '$1')
                .replace(/\s+/g, ' ').trim();
            events.push({
                text: cleanedText,
                html: htmlContent,
            });
        }
    });
    return events;
}

/**
 * Recursive function to unwrap all elements except <a>
 */
function unwrapElements($: cheerio.CheerioAPI, element: any) { // eslint-disable-line
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $(element).contents().each(function (_index: number, elem: any) {
        if (elem.type === 'tag' && elem.name !== 'a') {
            // Recursively process child elements
            unwrapElements($, elem);
            // Replace the element with its contents
            $(elem).replaceWith($(elem).contents());
        }
    });
}

/**
 *
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {null|Date}
 */
function createDate(year: number, month: number, day: number): null | Date {
    try {
        return new Date(Date.UTC(year, month - 1, day));
    }
    catch {
        return null;
    }
}

export default wiki2ics;
