import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 关键修复：强制指向 Shared 的 TypeScript 源码，跳过 dist 构建
      '@mesh/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  server: {
    host: true, // 允许局域网访问
    port: 5173
  }
});