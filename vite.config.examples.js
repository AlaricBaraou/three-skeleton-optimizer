import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'examples',
  base: '/three-skeleton-optimizer/',
  plugins: [
    react()
  ],
  build: {
    outDir: '../dist-examples',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/index.html'),
        native: resolve(__dirname, 'examples/native/index.html'),
        react: resolve(__dirname, 'examples/react/index.html'),
        bonesDebug: resolve(__dirname, 'examples/bones-debug/index.html')
      }
    }
  },
  resolve: {
    alias: {
      // Point directly to your source files instead of the package name
      'three-skeleton-optimizer': resolve(__dirname, './src/index.ts')
    }
  },
  // Add optimizeDeps to ensure proper handling of dependencies
  optimizeDeps: {
    include: ['three']
  },
  server: {
    watch: {
      // Include source files in watch
      included: ['src/**', 'examples/**']
    }
  }
});