/**
 * middleware/i18n.global.ts
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

import { defineNuxtRouteMiddleware, useRequestHeaders } from '#imports';
import { useLanguage } from '~/composables/useLanguage';

/**
 * Global middleware to detect and set the user's preferred language.
 * It checks the Accept-Language header on the server side
 * and navigator.language on the client side.
 */
export default defineNuxtRouteMiddleware(() => {
    const language = useLanguage();

    /**
     * Determines the user's preferred language.
     * - On the server side: Parses the Accept-Language header.
     * - On the client side: Uses navigator.language.
     *
     * @returns {string} The detected language code.
     */
    const determineLanguage = (): string => {
        if (import.meta.server) {
            // Server-Side: Access the Accept-Language header
            const headers = useRequestHeaders(['accept-language']);
            const acceptLanguage = headers['accept-language'];

            if (acceptLanguage) {
                // Extract the first language from the header
                return acceptLanguage.split(',')[0].split(';')[0].trim();
            }

            // Fallback if header is missing
            return 'en';
        }
        else {
            // Client-Side: Use navigator.language
            return navigator.language || 'en';
        }
    };

    // Detect the language
    const detectedLanguage = determineLanguage();

    // Update the global language state if it's different
    if (language.value !== detectedLanguage) {
        language.value = detectedLanguage;
    }
});
