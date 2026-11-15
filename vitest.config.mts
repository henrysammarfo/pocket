import { defineConfig } from 'vitest/config';
import path from 'node:path';
// @near-js packages ship ESM with extensionless imports, so vitest bundles them instead of loading them raw.
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'], server: { deps: { inline: [/@near-js/] } } }, resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } } });
