import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
