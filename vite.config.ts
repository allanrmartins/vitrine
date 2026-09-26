import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApi } from './server/bridge.ts';

// Porta fixa (5180): o atalho da área de trabalho abre sempre este endereço. VITRINE_PORT troca, se estiver ocupada.
const port = Number(process.env.VITRINE_PORT) || 5180;

export default defineConfig({
  plugins: [react(), localApi()],
  // Anuncios/ é gravada pelo próprio editor; não deve disparar reload.
  server: { port, strictPort: true, watch: { ignored: ['**/Anuncios/**'] } },
  preview: { port, strictPort: true },
  optimizeDeps: { exclude: ['@imgly/background-removal'] },
});
