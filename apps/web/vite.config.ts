import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: process.env.CAROCARD_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
});
