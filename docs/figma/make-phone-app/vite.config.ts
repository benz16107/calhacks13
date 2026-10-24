import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Figma Make runs the dev server on its own port and host.
  server: {
    port: process.env.FIGMA ? Number(process.env.PORT) : 5173,
    host: process.env.FIGMA ? process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0' : undefined,
    strictPort: Boolean(process.env.FIGMA),
  },
});
