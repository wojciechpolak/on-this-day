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

import type { IcsEvent } from '~/server/ics-parser';

/**
 * Events sorter
 */
export function sortEvents(a: IcsEvent, b: IcsEvent): number {
    return (b.DTSTART.valueOf() || b.DTEND.valueOf()) -
        (a.DTSTART.valueOf() || a.DTEND.valueOf());
}

/**
 * Escapes HTML, linkifies URLs, and replaces newlines with <br>.
 */
export function parseInputText(input: string) {
  function escapeHTML(str: string) {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return str.replace(/[&<>"']/g, (char) => replacements[char] ?? '');
  }

  function linkify(str: string) {
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    return str.replace(urlRegex, function (url) {
      const escapedURL = escapeHTML(url);
      return `<a href="${escapedURL}" target="_blank" rel="noopener noreferrer">${escapedURL}</a>`;
    });
  }

  const escapedText = escapeHTML(input);
  const linkedText = linkify(escapedText);
  return linkedText.replace(/\n/g, '<br>');
}
