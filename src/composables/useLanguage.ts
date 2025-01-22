/**
 * composables/useLanguage.ts
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

import type { Ref } from 'vue';

/**
 * Composable to manage the user's preferred language.
 */
export const useLanguage = (): Ref<string> => {
  // Initialize the language state with an empty string or a default value
  return useState<string>('language', () => '');
};
