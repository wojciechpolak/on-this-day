/**
 * useCurrentDate.test.ts
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

const mocks = vi.hoisted(() => ({
    useRuntimeConfig: vi.fn(),
}));

vi.mock('#imports', () => ({
    useRuntimeConfig: mocks.useRuntimeConfig,
}));

describe('useCurrentDate', () => {
    it('returns the fixed VRT date when VRT is enabled', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            public: {
                vrtEnabled: true,
                vrtFixedDate: '2026-03-21T12:00:00.000Z',
            },
        });
        const { useCurrentDate } = await import('./useCurrentDate');
        const result = useCurrentDate();
        expect(result.toISOString()).toBe('2026-03-21T12:00:00.000Z');
    });

    it('returns a live Date when VRT is disabled', async () => {
        mocks.useRuntimeConfig.mockReturnValue({
            public: {
                vrtEnabled: false,
                vrtFixedDate: undefined,
            },
        });
        const { useCurrentDate } = await import('./useCurrentDate');
        const before = Date.now();
        const result = useCurrentDate();
        const after = Date.now();
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
    });
});
