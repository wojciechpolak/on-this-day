/**
 * ics-parser.ts v20260328
 *
 * Copyright (C) 2024-2026 Wojciech Polak
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

export interface IcsEvent {
    DTSTART: Date;
    DTEND: Date;
    SUMMARY: string;
    DESCRIPTION: string;
    [key: string]: unknown;
}

export default class ICalParser {
    private icalData: string;
    private events: IcsEvent[];

    constructor(icalData: string) {
        this.icalData = icalData;
        /** @type {Array<IcsEvent>} */
        this.events = [];
        this.parseICal();
    }

    /**
     * Function to parse the date into a Date object
     * @param {string} dateString
     * @param {boolean} time
     * @returns {undefined|Date}
     */
    parseDate(dateString: string, time: boolean = true): undefined | Date {
        if (!dateString) {
            return undefined;
        }
        const year = parseInt(dateString.slice(0, 4), 10);
        const month = parseInt(dateString.slice(4, 6), 10) - 1;
        const day = parseInt(dateString.slice(6, 8), 10);
        if (time) {
            const hour = parseInt(dateString.slice(9, 11), 10);
            const minute = parseInt(dateString.slice(11, 13), 10);
            const second = parseInt(dateString.slice(13, 15), 10);
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        } else {
            return new Date(Date.UTC(year, month, day));
        }
    }

    parseICal() {
        // Split the lines and handle line continuations
        const lines = this.icalData.split(/\r\n|\n|\r/).reduce((acc: string[], line) => {
            if (line.startsWith(' ') || line.startsWith('\t')) {
                acc[acc.length - 1] += line.slice(1);
            } else {
                acc.push(line);
            }
            return acc;
        }, []);

        let event: IcsEvent;
        let insideAlarm = false;

        lines.forEach((line) => {
            if (line.startsWith('BEGIN:VEVENT')) {
                event = {} as IcsEvent;
            } else if (line.startsWith('END:VEVENT')) {
                this.events.push(event);
            } else if (line.startsWith('BEGIN:VALARM')) {
                insideAlarm = true;
            } else if (line.startsWith('END:VALARM')) {
                insideAlarm = false;
            } else if (event && !insideAlarm) {
                const [key, ...valueParts] = line.split(':');
                let value: Date | string | undefined = valueParts.join(':');
                if (key && value) {
                    if (key.includes(';VALUE=DATE') || key.includes(';TZID=')) {
                        const dateKey = key.split(';')[0]!; // Extract the actual key (DTSTART or DTEND)
                        if (dateKey === 'DTSTART' || dateKey === 'DTEND' || dateKey === 'DTSTAMP') {
                            value = this.parseDate(value, false);
                        }
                        event[dateKey] = value;
                        event[`${dateKey}_VALUE`] = 'DATE'; // Mark this as a DATE value
                    } else if (key.includes(';VALUE=TEXT')) {
                        const k = key.split(';')[0]!;
                        event[k] = this.normalizeFieldValue(k, this.unescapeICalString(value));
                        event[`${k}_VALUE`] = 'TEXT';
                    } else if (key.includes(';FMTTYPE=text/html')) {
                        const k = key.split(';')[0]!;
                        event[k] = this.normalizeFieldValue(k, this.unescapeICalString(value));
                        event[`${k}_VALUE`] = 'HTML';
                    } else {
                        if (key === 'DTSTART' || key === 'DTEND' || key === 'DTSTAMP') {
                            value = this.parseDate(value.padStart(16, '0'));
                        }
                        if (value === undefined) {
                            return;
                        }
                        const unescapedValue = this.unescapeICalString(value);
                        if (
                            typeof unescapedValue === 'string' &&
                            unescapedValue.startsWith('<html-blob>')
                        ) {
                            event[key] = this.normalizeFieldValue(
                                key,
                                this.decodeHtmlBlob(unescapedValue),
                            );
                        } else {
                            event[key] = this.normalizeFieldValue(key, unescapedValue);
                        }
                    }
                }
            }
        });
    }

    /**
     * Decoding HTML entities and stripping <html-blob> tags
     * @param {string} value - The raw value field from ICS data.
     * @returns {string}
     */
    decodeHtmlBlob(value: string): string {
        // Remove <html-blob> tags if they are present
        value = value.replace(/<\/?html-blob>/gi, '');
        // Node.js environment: Use a custom decoder for HTML entities
        return this.decodeHtmlEntities(value);
    }

    /**
     * Simple HTML entities decoder for Node.js
     * @param {string} str - The string containing HTML entities.
     * @returns {string} - The decoded string.
     */
    decodeHtmlEntities(str: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'",
            '&nbsp;': ' ',
        };
        return str.replace(/&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/g, (match: string) => {
            if (entities[match]) {
                return entities[match];
            }
            if (match.startsWith('&#x')) {
                const codePoint = Number.parseInt(match.slice(3, -1), 16);
                return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
            }
            if (match.startsWith('&#')) {
                const codePoint = Number.parseInt(match.slice(2, -1), 10);
                return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
            }
            return match;
        });
    }

    /**
     * Normalizes text fields that may contain accidental HTML markup.
     * @param {string} key
     * @param {string} value
     * @returns {string}
     */
    normalizeTextField(key: string, value: string): string {
        if (key !== 'DESCRIPTION' || !this.looksLikeHtml(value)) {
            return value;
        }

        const blockBreaks = value
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(?:p|div|tr|table|tbody|thead|tfoot|ul|ol|li|td|th|h[1-6])>/gi, '\n');
        const decoded = this.decodeHtmlEntities(blockBreaks).replace(/\u00A0/g, ' ');

        return decoded
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Normalizes a parsed field when it contains text and leaves dates untouched.
     * @param {string} key
     * @param {Date|string} value
     * @returns {Date|string}
     */
    normalizeFieldValue(key: string, value: Date | string): Date | string {
        if (typeof value !== 'string') {
            return value;
        }
        return this.normalizeTextField(key, value);
    }

    /**
     * Detects whether a text field contains HTML tags rather than plain text.
     * @param {string} value
     * @returns {boolean}
     */
    looksLikeHtml(value: string): boolean {
        return /<\/?[a-z][^>]*>/i.test(value);
    }

    /**
     * Unescape iCalendar strings
     * @param {string} str
     * @returns {string}
     */
    unescapeICalString(str: string | Date): string | Date {
        if (typeof str !== 'string') {
            return str;
        }
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');
    }

    getEvents() {
        return this.events;
    }
}
