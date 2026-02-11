import { defineConfig } from 'vite';
import { importCSSSheet } from '@roenlie/vite-plugin-import-css-sheet';

export default defineConfig({
  plugins: [importCSSSheet()]
});
