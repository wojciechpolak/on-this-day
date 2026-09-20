/**
 * server/ics-response.ts
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

import ICalParser, { type IcsEvent } from '#shared/ics-parser';
import { sortEvents } from '#shared/helpers';

/**
 * Minimal structural shape of the parts of an H3 event this module touches.
 */
export interface IcsResponseEvent {
    node: {
        res: {
            setHeader: (name: string, value: string) => unknown;
            end: (chunk: string) => void;
        };
    };
}

/**
 * Sends ICS data either verbatim (`raw`) or as a sorted list of parsed events.
 */
export function respondWithIcs(
    event: IcsResponseEvent,
    raw: unknown,
    icsData: string,
): IcsEvent[] | void {
    if (raw) {
        event.node.res.setHeader('Content-Type', 'text/calendar');
        return event.node.res.end(icsData);
    }
    return new ICalParser(icsData).getEvents().sort(sortEvents);
}
