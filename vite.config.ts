/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        // The dev stack serves this through traefik under the hostname rewetflux.
        allowedHosts: ['rewetflux'],
    },
    base: './',
    build: {
        sourcemap: true,
    },
    test: {
        environment: 'jsdom',
    },
    resolve: {
        alias: {
            'proj4-fully-loaded': resolve(__dirname, 'node_modules/proj4/dist/proj4.js'),
        },
    },
});
