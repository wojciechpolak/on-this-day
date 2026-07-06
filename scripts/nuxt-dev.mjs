#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const nuxtCli = path.join(rootDir, 'node_modules/nuxt/bin/nuxt.mjs');
const env = { ...process.env };
const devTmpDir =
    env.OTD_DEV_TMPDIR || (process.platform === 'darwin' ? '/tmp' : env.TMPDIR || '/tmp');

// Nuxt/Vite creates an IPC socket in the temp directory; macOS rejects long socket paths.
env.TMPDIR = devTmpDir;
env.TMP = devTmpDir;
env.TEMP = devTmpDir;

const child = spawn(process.execPath, [nuxtCli, 'dev', ...process.argv.slice(2)], {
    env,
    stdio: 'inherit',
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 1);
});
