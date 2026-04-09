/**
 * vrt-now.test.ts
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

import { describe, expect, it } from 'vitest';

import { DEFAULT_VRT_FIXED_DATE, createCurrentDate, resolveVrtFixedDate } from './vrt-now';

describe('resolveVrtFixedDate', () => {
    it('returns the default when called with no argument', () => {
        expect(resolveVrtFixedDate()).toBe(DEFAULT_VRT_FIXED_DATE);
    });

    it('returns the default when called with an invalid date string', () => {
        expect(resolveVrtFixedDate('not-a-date')).toBe(DEFAULT_VRT_FIXED_DATE);
    });

    it('returns the ISO string for a valid date input', () => {
        expect(resolveVrtFixedDate('2025-06-15T08:00:00.000Z')).toBe('2025-06-15T08:00:00.000Z');
    });

    it('normalises a date-only string to a full ISO string', () => {
        const result = resolveVrtFixedDate('2025-06-15');
        expect(result).toMatch(/^2025-06-15T/);
    });
});

describe('createCurrentDate', () => {
    it('returns the fixed VRT date when isVrt is true', () => {
        const result = createCurrentDate(true, '2025-06-15T08:00:00.000Z');
        expect(result.toISOString()).toBe('2025-06-15T08:00:00.000Z');
    });

    it('returns the default VRT date when isVrt is true and no fixedDate is provided', () => {
        const result = createCurrentDate(true, undefined);
        expect(result.toISOString()).toBe(DEFAULT_VRT_FIXED_DATE);
    });

    it('returns a live Date near now when isVrt is false', () => {
        const before = Date.now();
        const result = createCurrentDate(false);
        const after = Date.now();
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
    });
});
