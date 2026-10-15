// @ts-check
import { defineConfig } from 'astro/config';

// Set `site` (and `base` if served from a sub-path, e.g. GitHub Pages project sites) before deploying.
export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
});
