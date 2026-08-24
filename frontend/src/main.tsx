import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/montar.css'

import { App } from './App'
import { DeckProvider } from './state/deck'
import { ToastProvider } from './state/toasts'

const root = document.getElementById('root')
if (!root) throw new Error('elemento #root não encontrado')

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <DeckProvider>
        <App />
      </DeckProvider>
    </ToastProvider>
  </StrictMode>,
)
