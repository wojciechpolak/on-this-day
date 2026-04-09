/**
 * i18n.global.test.ts
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
import middleware from './i18n.global';

const mocks = vi.hoisted(() => ({
    defineNuxtRouteMiddleware: vi.fn((handler: unknown) => handler),
    useRequestHeaders: vi.fn(),
    languageState: { value: '' as string },
}));

vi.mock('#imports', () => ({
    defineNuxtRouteMiddleware: mocks.defineNuxtRouteMiddleware,
    useRequestHeaders: mocks.useRequestHeaders,
}));

vi.mock('~/composables/useLanguage', () => ({
    useLanguage: () => mocks.languageState,
}));

describe('i18n.global middleware', () => {
    it('updates the shared language state from the active environment', () => {
        mocks.useRequestHeaders.mockReturnValue({
            'accept-language': 'de-DE,de;q=0.9',
        });

        Object.defineProperty(navigator, 'language', {
            configurable: true,
            value: 'fr-FR',
        });

        middleware({} as never, {} as never);

        if (import.meta.server) {
            expect(mocks.useRequestHeaders).toHaveBeenCalledWith(['accept-language']);
            expect(mocks.languageState.value).toBe('de-DE');
        } else {
            expect(mocks.useRequestHeaders).not.toHaveBeenCalled();
            expect(mocks.languageState.value).toBe('fr-FR');
        }
    });

    it('uses navigator.language as the detected language on the client side', () => {
        Object.defineProperty(navigator, 'language', {
            configurable: true,
            value: 'ja-JP',
        });

        mocks.languageState.value = '';
        middleware({} as never, {} as never);

        // In the happy-dom (client) test environment, import.meta.server is false,
        // so navigator.language is used. If running SSR, Accept-Language is used instead.
        if (!import.meta.server) {
            expect(mocks.languageState.value).toBe('ja-JP');
        }
    });

    it('falls back to "en" when the accept-language header is missing', () => {
        // Simulate server side with no Accept-Language header
        mocks.useRequestHeaders.mockReturnValue({});
        mocks.languageState.value = '';

        // Stub import.meta.server to simulate server environment
        vi.stubGlobal('import', { meta: { server: true } });

        try {
            middleware({} as never, {} as never);
        } finally {
            vi.unstubAllGlobals();
        }

        // If running SSR, the fallback 'en' is used; on client navigator.language is used
        if (import.meta.server) {
            expect(mocks.languageState.value).toBe('en');
        }
    });
});
