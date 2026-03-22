/**
 * useLanguage.test.ts
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

import { describe, expect, it, vi } from 'vitest';
import { useLanguage } from './useLanguage';

const mocks = vi.hoisted(() => ({
    useState: vi.fn(),
}));

vi.mock('#imports', () => ({
    useState: mocks.useState,
}));

describe('useLanguage', () => {
    it('returns the shared language state', () => {
        const languageState = { value: '' };
        mocks.useState.mockReturnValue(languageState);

        const language = useLanguage();

        expect(language).toBe(languageState);
        expect(language.value).toBe('');
    });
});
