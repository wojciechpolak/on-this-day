/**
 * utils/helpers.ts
 *
 * On This Day (C) 2025 Wojciech Polak
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

import type { IcsEvent } from '#shared/ics-parser';

/**
 * Events sorter
 */
export function sortEvents(a: IcsEvent, b: IcsEvent): number {
    return (b.DTSTART.valueOf() || b.DTEND.valueOf()) - (a.DTSTART.valueOf() || a.DTEND.valueOf());
}

/**
 * Escapes HTML, linkifies URLs, and replaces newlines with <br>.
 */
export function parseInputText(input: string) {
    const replacements: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    const urlRegex = /https?:\/\/[^\s<]+/gi;

    function escapeHTML(str: string) {
        return str.replace(/[&<>"']/g, (char) => replacements[char] ?? '');
    }

    function splitTrailingPunctuation(url: string) {
        const trailing: string[] = [];
        while (/[),.;!?]$/.test(url)) {
            trailing.unshift(url.slice(-1));
            url = url.slice(0, -1);
        }
        return { url, trailing: trailing.join('') };
    }

    let result = '';
    let lastIndex = 0;

    for (const match of input.matchAll(urlRegex)) {
        const matchedUrl = match[0];
        const start = match.index ?? 0;
        const end = start + matchedUrl.length;
        const { url, trailing } = splitTrailingPunctuation(matchedUrl);

        result += escapeHTML(input.slice(lastIndex, start));

        if (url) {
            const escapedUrl = escapeHTML(url);
            result += `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
        }

        result += escapeHTML(trailing);
        lastIndex = end;
    }

    result += escapeHTML(input.slice(lastIndex));
    return result.replace(/\n/g, '<br>');
}
