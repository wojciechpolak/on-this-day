/**
 * cache.test.ts
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const nodeCache = vi.fn();
  const instance = { nodeCache };

  return {
    nodeCache,
    instance,
  };
});

vi.mock('node-cache', () => ({
  default: function NodeCacheMock(options: { stdTTL: number }) {
    mocks.nodeCache(options);
    return mocks.instance;
  },
}));

async function loadCacheModule() {
  vi.resetModules();
  return await import('./cache');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cache', () => {
  it('uses the default TTL when env is not configured', async () => {
    const original = process.env.appCacheTtl;
    delete process.env.appCacheTtl;

    const { default: cache } = await loadCacheModule();

    expect(cache).toBe(mocks.instance);
    expect(mocks.nodeCache).toHaveBeenCalledWith({ stdTTL: 86400 });

    if (original === undefined) {
      delete process.env.appCacheTtl;
    }
    else {
      process.env.appCacheTtl = original;
    }
  });

  it('uses the configured TTL when env is set', async () => {
    const original = process.env.appCacheTtl;
    process.env.appCacheTtl = '1200';

    const { default: cache } = await loadCacheModule();

    expect(cache).toBe(mocks.instance);
    expect(mocks.nodeCache).toHaveBeenCalledWith({ stdTTL: 1200 });

    if (original === undefined) {
      delete process.env.appCacheTtl;
    }
    else {
      process.env.appCacheTtl = original;
    }
  });
});
