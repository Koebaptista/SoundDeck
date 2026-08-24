import { useEffect, useRef } from 'react'

/**
 * Atalhos de teclado do modo operar.
 *
 * São a rede de segurança, não a interface principal — a entrada primária é o
 * mouse. Duas regras não negociáveis:
 *
 * 1. Teclas de cue são resolvidas **dentro da cena ativa**, então `1..9` pode
 *    ser reusado em toda cena sem conflito global.
 * 2. Nada dispara enquanto o foco está em um campo de texto. Digitar a deixa de
 *    um cue não pode fazer o teatro inteiro ouvir um trovão.
 */

interface Handlers {
  enabled: boolean
  /** Tecla → id do cue, já restrito à cena ativa. */
  keymap: Map<string, string>
  fire: (cueId: string) => void
  stopAll: () => void
  togglePauseAll: () => void
  moveScene: (delta: number) => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useShortcuts(handlers: Handlers) {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const h = latest.current
      if (!h.enabled || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return
      // Um diálogo aberto é uma conversa; atalhos globais não interrompem.
      if (document.querySelector('dialog[open]')) return

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          h.stopAll()
          return
        case ' ':
          // Sem isto o ESPAÇO acionaria o cue focado *e* a pausa geral.
          // Teclado dispara cue com Enter; ESPAÇO é sempre a pausa geral.
          event.preventDefault()
          h.togglePauseAll()
          return
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          h.moveScene(1)
          return
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          h.moveScene(-1)
          return
      }

      const cueId = h.keymap.get(event.key.toLowerCase())
      if (cueId) {
        event.preventDefault()
        h.fire(cueId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
