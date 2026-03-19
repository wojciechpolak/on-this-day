/**
 * logger.test.ts
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
  function ConsoleTransport(this: never) {}
  const createLogger = vi.fn((config: unknown) => ({ config }));
  const combine = vi.fn();
  const timestamp = vi.fn(() => 'timestamp');
  const splat = vi.fn(() => 'splat');
  const printf = vi.fn((handler: (input: { level: string; message: string; timestamp: string }) => string) => handler);

  return {
    ConsoleTransport,
    createLogger,
    combine,
    timestamp,
    splat,
    printf,
  };
});

vi.mock('winston', () => ({
  createLogger: mocks.createLogger,
  format: {
    combine: mocks.combine,
    timestamp: mocks.timestamp,
    splat: mocks.splat,
    printf: mocks.printf,
  },
  transports: {
    Console: mocks.ConsoleTransport,
  },
}));

async function loadLogger() {
  vi.resetModules();
  return await import('./logger');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logger', () => {
  it('uses the LOG_LEVEL env value when present', async () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';

    const { default: logger } = await loadLogger();

    expect(logger).toEqual({ config: expect.any(Object) });
    expect(mocks.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        transports: [expect.any(mocks.ConsoleTransport)],
      }),
    );

    if (original === undefined) {
      delete process.env.LOG_LEVEL;
    }
    else {
      process.env.LOG_LEVEL = original;
    }
  });

  it('falls back to info when LOG_LEVEL is not set', async () => {
    const original = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;

    await loadLogger();

    expect(mocks.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
      }),
    );

    if (original === undefined) {
      delete process.env.LOG_LEVEL;
    }
    else {
      process.env.LOG_LEVEL = original;
    }
  });
});
