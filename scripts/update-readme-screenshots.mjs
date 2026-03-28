#!/usr/bin/env node
/**
 * update-readme-screenshots.mjs
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

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const screenshotDir = path.join(rootDir, '.screenshots');
const serverScript = path.join(rootDir, 'scripts/start-playwright-webserver.mjs');
const baseUrl = 'http://127.0.0.1:4173';
const screenshotDate = process.env.VRT_FIXED_DATE || '2024-11-02T12:00:00.000Z';
const viewport = { width: 800, height: 1028 };

function disableMotionCss() {
    return `
        *,
        *::before,
        *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
        }
    `;
}

async function waitForServer(serverProcess, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (serverProcess.exitCode !== null) {
            throw new Error(`Screenshot server exited early with code ${serverProcess.exitCode}.`);
        }

        try {
            const response = await fetch(baseUrl);
            if (response.ok) {
                return;
            }
        } catch {}

        await delay(1_000);
    }

    throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function captureScreenshot(browser, colorScheme, filename) {
    const context = await browser.newContext({
        colorScheme,
        locale: 'en-US',
        timezoneId: 'UTC',
        viewport,
    });

    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: disableMotionCss() });
    await page.getByRole('tab', { name: 'Historical Events' }).click();
    await page.locator('#history-container .event').first().waitFor({ state: 'visible' });
    await page.screenshot({
        path: path.join(screenshotDir, filename),
        animations: 'disabled',
    });
    await context.close();
}

async function main() {
    await mkdir(screenshotDir, { recursive: true });

    const serverProcess = spawn(process.execPath, [serverScript], {
        cwd: rootDir,
        env: {
            ...process.env,
            VRT: '1',
            VRT_FIXED_DATE: screenshotDate,
        },
        stdio: 'inherit',
    });

    try {
        await waitForServer(serverProcess);

        const browser = await chromium.launch();
        try {
            await captureScreenshot(browser, 'light', 'main-view-light.png');
            await captureScreenshot(browser, 'dark', 'main-view-dark.png');
        } finally {
            await browser.close();
        }
    } finally {
        serverProcess.kill('SIGINT');
        await new Promise((resolve) => {
            serverProcess.once('exit', () => resolve());
        });
    }

    /* oxlint-disable no-console */
    console.log(`Updated README screenshots in ${screenshotDir}`);
}

await main();
