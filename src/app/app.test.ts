/**
 * app.test.ts
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
import { mount } from '@vue/test-utils';
import AppComponent from './app.vue';

const mocks = vi.hoisted(() => ({
  useHead: vi.fn(),
}));

vi.mock('#imports', () => ({
  useHead: mocks.useHead,
}));

describe('app.vue', () => {
  it('configures the base document head', () => {
    const wrapper = mount(AppComponent, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<section><slot /></section>',
          },
          NuxtPage: {
            template: '<div data-testid="page-slot" />',
          },
          NuxtPwaAssets: true,
        },
      },
    });

    expect(mocks.useHead).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'On This Day',
      }),
    );
    expect(wrapper.find('[data-testid="page-slot"]').exists()).toBe(true);
  });
});
