import { useEffect, useRef, useSyncExternalStore } from 'react'
import { engine } from './engine'
import type { AssetStatus, Voice } from '../types'

/**
 * Ponte entre o engine e o React.
 *
 * O React só é notificado quando o *conjunto* de vozes muda: disparo, pausa,
 * fim. Posição de reprodução nunca vira estado — quem desenha barra ou
 * contagem lê o engine dentro de `requestAnimationFrame` e escreve direto no
 * DOM. Um deck de 60 cues não pode re-renderizar 60 vezes por segundo.
 */

export function useVoices(): Voice[] {
  return useSyncExternalStore(engine.subscribe, engine.getVoices, engine.getVoices)
}

export function useStatuses(): Record<string, AssetStatus> {
  return useSyncExternalStore(engine.subscribe, engine.getStatuses, engine.getStatuses)
}

/** Cues já disparados nesta sessão — orientação no roteiro, sem impor ordem. */
export function useFired(): ReadonlySet<string> {
  return useSyncExternalStore(engine.subscribe, engine.getFired, engine.getFired)
}

const readLocked = () => engine.isLocked()
const readMaster = () => engine.getMaster()

export function useAudioLocked(): boolean {
  return useSyncExternalStore(engine.subscribe, readLocked, readLocked)
}

export function useMasterVolume(): number {
  return useSyncExternalStore(engine.subscribe, readMaster, readMaster)
}

/**
 * Roda `frame` a cada quadro enquanto `active` for verdadeiro. Parado, não
 * consome nada: em repouso o deck não tem laço de animação nenhum.
 */
export function useAnimationFrame(active: boolean, frame: () => void) {
  const latest = useRef(frame)
  latest.current = frame

  useEffect(() => {
    if (!active) return
    let raf = 0
    const tick = () => {
      latest.current()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
}
