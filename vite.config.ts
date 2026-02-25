import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        'process.env': process.env,
    },
    server: {
        host: true,
    },
    base: './',
    build: {
        sourcemap: true,
    },
    resolve: {
        alias: {
            'proj4-fully-loaded': resolve(__dirname, 'node_modules/proj4/dist/proj4.js'),
        },
    },
});
