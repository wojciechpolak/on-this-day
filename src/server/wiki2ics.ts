/**
 * wiki2ics.ts
 *
 * On This Day (C) 2024-2026 Wojciech Polak
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
import { isTag, type Element } from 'domhandler';
import { DateTime } from 'luxon';
import * as cheerio from 'cheerio';
import logger from './logger';

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
    };
    error?: {
        code: string;
        info: string;
        '*': string;
    };
}

export interface WikiEvent {
    html: string;
    text: string;
}

/**
 * Resolves the requested date, falling back to the current local date.
 */
function resolveDate(dateParam: string): DateTime {
    if (!dateParam) {
        return DateTime.local();
    }
    const dateObj = DateTime.fromISO(dateParam, { zone: 'utc' });
    if (!dateObj.isValid) {
        throw new Error('Invalid date format. Please use ISO format (YYYY-MM-DD).');
    }
    return dateObj;
}

/**
 * Formats the date into the Wikipedia page title format, considering localization.
 */
function formatWikiDate(dateObj: DateTime, lang: string): string {
    if (lang === 'pl' || lang === 'es' || lang === 'de' || lang === 'fr') {
        // e.g. '1 lipca'
        return dateObj.setLocale(lang).toLocaleString({
            day: 'numeric',
            month: 'long',
        });
    }
    const localizedMonth = dateObj.setLocale(lang).toFormat('LLLL'); // Full month name
    const localizedDay = dateObj.setLocale(lang).toFormat('d'); // Day of the month
    return `${localizedMonth} ${localizedDay}`; // e.g. 'October 21'
}

/**
 * Fetches and parses the events of every requested section.
 */
async function fetchSectionEvents(
    apiUrl: string,
    dateStr: string,
    sectionTitles: string[],
    sectionIndexes: Record<string, string>,
    lang: string,
): Promise<Record<string, WikiEvent[]>> {
    const allEvents: Record<string, WikiEvent[]> = {};

    for (const sectionTitle of sectionTitles) {
        if (!(sectionTitle in sectionIndexes)) {
            logger.info(`Section '${sectionTitle}' not found.`);
            allEvents[sectionTitle] = [];
            continue;
        }
        const sectionIndex = sectionIndexes[sectionTitle]!;
        const content = await getSectionContent(apiUrl, dateStr, sectionIndex);
        const events = extractEventsFromContent(content, dateStr, lang);
        logger.debug(`Extracted ${events.length} events from section ${sectionTitle}`);
        allEvents[sectionTitle] = events;
    }

    return allEvents;
}

/**
 * Splits an entry such as '1096 – Event description' into a year and a description.
 * Entries without a year and BCE entries are rejected.
 */
function parseEventEntry(eventText: string, lang: string): { year: number; text: string } | null {
    // Match patterns like '1096 – Event description' or '1096 BC – Event description'
    const match = eventText.match(wikiExtractor[lang] || wikiExtractor['en'] || '');
    if (!match || match[2]) {
        // No year found, or a BCE date; skip the event
        return null;
    }
    // Clean description
    const text = (match[3] || '')
        .replace(/\s+([.,])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    return { year: parseInt(match[1] || '', 10), text };
}

/**
 * Turns the extracted sections into an iCalendar document.
 */
function buildCalendar(
    allEvents: Record<string, WikiEvent[]>,
    dateStr: string,
    month: number,
    day: number,
    lang: string,
): string {
    const cal = ical({ name: `Events on ${dateStr}` });

    for (const [section, events] of Object.entries(allEvents)) {
        for (const event of events) {
            const entry = parseEventEntry(event.text, lang);
            if (!entry) {
                continue;
            }

            const eventDate = createDate(entry.year, month, day);
            if (!eventDate) {
                // Invalid date; skip the event
                continue;
            }

            // Add event to calendar
            cal.createEvent({
                start: eventDate,
                end: eventDate,
                summary: `${section}: ${entry.text}`,
                description: {
                    plain: entry.text,
                    html: event.html,
                },
                id: generateUID(),
            });
        }
    }

    // Return ICS data as string
    return cal.toString();
}

/**
 * Fetches Wikipedia's On This Day events and converts them to ICS
 */
async function wiki2ics(dateParam: string, sectionTitles: string[], lang = 'en'): Promise<string> {
    const dateObj = resolveDate(dateParam);

    sectionTitles = (sectionTitles.length && sectionTitles) || getSectionTitles(lang);
    logger.debug('sectionTitles: %s', sectionTitles);

    const dateStr = formatWikiDate(dateObj, lang);

    logger.info(`Fetching Wikipedia events for ${dateStr} in language ${lang}`);

    // Wikipedia API URLs
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;

    // Fetch section indexes
    const sectionIndexes = await getSectionIndexes(apiUrl, dateStr, sectionTitles);
    if (Object.keys(sectionIndexes).length === 0) {
        logger.error('Failed to retrieve section indexes.');
        return '';
    }

    const allEvents = await fetchSectionEvents(
        apiUrl,
        dateStr,
        sectionTitles,
        sectionIndexes,
        lang,
    );

    return buildCalendar(allEvents, dateStr, dateObj.month, dateObj.day, lang);
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
export function getSectionTitles(lang = 'en'): string[] {
    const titles: Record<string, string[]> = {
        en: ['Events', 'Births', 'Deaths'],
        pl: ['Wydarzenia w Polsce', 'Wydarzenia na świecie', 'Urodzili się', 'Zmarli'],
        es: ['Acontecimientos', 'Nacimientos', 'Fallecimientos'],
        de: ['Ereignisse', 'Geboren', 'Gestorben'],
        fr: ['Événements', 'Naissances', 'Décès'],
    };
    return titles[lang] || titles['en'] || [''];
}

/**
 * Gets section indexes
 */
async function getSectionIndexes(
    apiUrl: string,
    title: string,
    sectionTitles: string[],
): Promise<Record<string, string>> {
    const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'sections',
        format: 'json',
    });

    const data: WikiSectionsResponse = await $fetch(`${apiUrl}?${params}`, {
        responseType: 'json',
    });

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
async function getSectionContent(
    apiUrl: string,
    title: string,
    sectionIndex: string,
): Promise<string> {
    const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'text',
        section: sectionIndex,
        format: 'json',
    });

    const data: WikiSectionsResponse = await $fetch(`${apiUrl}?${params}`, {
        responseType: 'json',
    });

    if (data.error) {
        logger.error(`Error fetching section content: ${data.error.info}`);
        return '';
    }

    return data.parse.text['*'];
}

/**
 * Extracts events from content
 */
export function extractEventsFromContent(
    content: string,
    title: string,
    lang: string,
): WikiEvent[] {
    const $ = cheerio.load(content);
    const events: WikiEvent[] = [];

    $('li').each((_i: number, elem) => {
        // Remove all <sup> elements within this <li>
        $(elem).find('sup').remove();

        // Process all <a> tags to include full URLs
        $(elem)
            .find('a')
            .each((_i, link) => {
                const $link = $(link);
                const href = $link.attr('href');

                if (!href) {
                    return;
                }

                // Build the full URL
                let fullUrl = href;
                if (href.startsWith('/')) {
                    fullUrl = `https://${lang}.wikipedia.org${href}`;
                } else if (href.startsWith('#')) {
                    fullUrl =
                        `https://${lang}.wikipedia.org/wiki/` + encodeURIComponent(title) + href;
                } else if (href.startsWith('http')) {
                    // fullUrl is already complete
                } else {
                    fullUrl = `https://${lang}.wikipedia.org/wiki/${href}`;
                }

                // Update the href attribute to the full URL
                $link.attr('href', fullUrl).attr('rel', 'noreferrer').attr('target', '_blank');
            });

        // Remove all tags except <a> by unwrapping them
        unwrapElements($, elem);

        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        const htmlContent = $(elem).html() ?? '';

        // Check if a text starts with a year and an en dash
        if ((wikiExtractor[lang] || wikiExtractor['en'] || / /).test(text)) {
            // Remove extra spaces before punctuation
            const cleanedText = text
                .replace(/\s+([.,])/g, '$1')
                .replace(/\s+/g, ' ')
                .trim();
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
function unwrapElements($: cheerio.CheerioAPI, element: Element) {
    $(element)
        .contents()
        .each(function (_index: number, elem) {
            if (isTag(elem) && elem.name !== 'a') {
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
export function createDate(year: number, month: number, day: number): null | Date {
    try {
        return new Date(Date.UTC(year, month - 1, day));
    } catch {
        return null;
    }
}

export default wiki2ics;
