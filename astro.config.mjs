import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  output: 'server',
  trailingSlash: 'always',
  redirects: {
    '/pages/shelf': '/shelf',
    '/pages/privacy': '/privacy',
    '/pages/terms': '/terms',
  },
  server: {
    // Bind to all interfaces so the container is reachable from
    // DigitalOcean's internal routing and health-check layers.
    host: true,
    port: 8080,
  },
  adapter: node({
    mode: 'standalone',
  }),
  security: {
    checkOrigin: false,
  },
  session: {
    driver: {
      entrypoint: "unstorage/drivers/null",
      config: {},
    },
  },
});
