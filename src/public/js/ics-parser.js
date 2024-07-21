/**
 * ics-parser.js v20240913
 *
 * Copyright (C) 2024 Wojciech Polak
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

/**
 * @typedef {object} IcsEvent
 * @property {Date} DTSTART
 * @property {Date} DTEND
 * @property {string} SUMMARY
 * @property {string} DESCRIPTION
 */

class ICalParser {
    constructor(icalData) {
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
    parseDate(dateString, time = true) {
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
        }
        else {
            return new Date(Date.UTC(year, month, day));
        }
    }

    parseICal() {
        // Split the lines and handle line continuations
        const lines = this.icalData.split(/\r\n|\n|\r/).reduce((acc, line) => {
            if (line.startsWith(' ') || line.startsWith('\t')) {
                acc[acc.length - 1] += line.slice(1);
            }
            else {
                acc.push(line);
            }
            return acc;
        }, []);

        let event = null;
        let insideAlarm = false;

        lines.forEach(line => {
            if (line.startsWith('BEGIN:VEVENT')) {
                event = {};
            }
            else if (line.startsWith('END:VEVENT')) {
                this.events.push(event);
                event = null;
            }
            else if (line.startsWith('BEGIN:VALARM')) {
                insideAlarm = true;
            }
            else if (line.startsWith('END:VALARM')) {
                insideAlarm = false;
            }
            else if (event && !insideAlarm) {
                const [key, ...valueParts] = line.split(':');
                let value = valueParts.join(':');
                if (key && value) {
                    if (key.includes(';VALUE=DATE') ||
                        key.includes(';TZID=')) {
                        const dateKey = key.split(';')[0]; // Extract the actual key (DTSTART or DTEND)
                        if (dateKey === 'DTSTART' || dateKey === 'DTEND' || dateKey === 'DTSTAMP') {
                            value = this.parseDate(value, false);
                        }
                        event[dateKey] = value;
                        event[`${dateKey}_VALUE`] = 'DATE'; // Mark this as a DATE value
                    }
                    else {
                        if (key === 'DTSTART' || key === 'DTEND' || key === 'DTSTAMP') {
                            value = this.parseDate(value);
                        }
                        event[key] = this.unescapeICalString(value);
                    }
                }
            }
        });
    }

    /**
     * Unescape iCalendar strings
     * @param {string} str
     * @returns {string}
     */
    unescapeICalString(str) {
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
