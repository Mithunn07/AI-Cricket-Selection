import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path to ensure assets load correctly on subpaths (like GitHub Pages)
  base: './',
});
