import { defineConfig, devices } from '@playwright/test';

const visualMode = process.env.VRT === '1';
const defaultReporter = process.env.CI ? ([['github']] as const) : ([['list']] as const);
const visualReporter = [...defaultReporter, ['html', { open: 'never' }]] as const;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    timeout: 60_000,
    workers: 1,
    expect: {
        timeout: 15_000,
        toHaveScreenshot: {
            pathTemplate: '.visual-regression/{testFilePath}/{arg}{ext}',
        },
    },
    reporter: visualMode ? visualReporter : defaultReporter,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        locale: 'en-US',
        timezoneId: 'UTC',
        actionTimeout: 10_000,
        navigationTimeout: 20_000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node scripts/start-playwright-webserver.mjs',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
