import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `process` é do Node que executa este arquivo, não do navegador. O tsconfig
// do deck carrega só os tipos de `vite/client`, então declarar o que é usado
// aqui mantém o `vite.config.ts` dentro da conferência sem puxar @types/node.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    // Desligado por padrão, porque polling gasta CPU à toa e o bind mount do
    // Docker desta máquina entrega os eventos de arquivo normalmente. Existe
    // para o caso em que ele não entrega — montagem mais antiga, disco de
    // rede — e o hot reload simplesmente para de acordar: `VITE_POLL=1`.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
  build: { target: 'es2022', sourcemap: true },
})
