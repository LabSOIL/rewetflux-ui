import { defineConfig } from '@playwright/test';

const PORT = 4173;

// The built site is served by vite preview; run `yarn build` first. Tiles are answered by the
// tests, so nothing here needs the network.
export default defineConfig({
    testDir: './e2e',
    testMatch: '*.e2e.js',
    reporter: 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        browserName: 'firefox',
    },
    webServer: {
        command: `yarn serve --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
    },
});
