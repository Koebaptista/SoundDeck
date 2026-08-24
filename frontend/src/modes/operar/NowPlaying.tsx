import { useRef, useState } from 'react'
import type { Voice } from '../../types'
import { engine, SKIP } from '../../audio/engine'
import { useAnimationFrame } from '../../audio/useEngine'
import { clock, remaining } from '../../lib/format'
import {
  Back10Icon,
  Fwd10Icon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
  StopIcon,
} from '../../icons'

/**
 * Tocando agora — uma linha por áudio vivo.
 *
 * O estado nunca é adivinhado: o que toca, há quanto tempo, quanto falta e em
 * que volume está sempre visível, sem nenhuma interação. Quando não há som, o
 * painel some e devolve o espaço à grade de cues.
 */

export function NowPlaying({ voices }: { voices: Voice[] }) {
  return (
    <aside className="now" aria-label="Tocando agora">
      <h2 className="now__title">
        Tocando agora
        <span className="now__count num">{voices.length}</span>
      </h2>
      <ul className="now__list">
        {voices.map((voice) => (
          <VoiceRow key={voice.id} voice={voice} />
        ))}
      </ul>
    </aside>
  )
}

function VoiceRow({ voice }: { voice: Voice }) {
  const scrub = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  const time = useRef<HTMLSpanElement>(null)
  /** Último segundo anunciado, para não inundar o leitor de tela a 60fps. */
  const announced = useRef(-1)
  const [arrastando, setArrastando] = useState(false)

  const seekable = voice.duration > 0

  /**
   * Escreve a posição direto no DOM. Serve ao relógio do engine e ao arrasto —
   * os dois pintam a mesma barra, nunca ao mesmo tempo.
   */
  const pintar = (position: number) => {
    const ratio = seekable ? Math.min(1, Math.max(0, position / voice.duration)) : 0
    if (fill.current) fill.current.style.transform = `scaleX(${ratio})`
    if (knob.current) knob.current.style.left = `${ratio * 100}%`
    if (time.current) time.current.textContent = remaining(position, voice.duration)
    const second = Math.floor(position)
    if (scrub.current && second !== announced.current) {
      announced.current = second
      scrub.current.setAttribute('aria-valuenow', String(second))
      scrub.current.setAttribute('aria-valuetext', clock(position))
    }
  }

  // Enquanto o operador arrasta, quem manda na barra é o dedo, não o relógio:
  // sem esta trava as duas escritas brigariam a cada quadro.
  useAnimationFrame(!voice.paused && !arrastando, () => pintar(engine.position(voice.id)))

  /** Posição, em segundos, do ponto do trilho onde o ponteiro está. */
  const posicaoDoPonteiro = (clientX: number): number => {
    const box = scrub.current?.getBoundingClientRect()
    if (!box || box.width <= 0) return 0
    return ((clientX - box.left) / box.width) * voice.duration
  }

  /**
   * Durante o arrasto só a barra se move; o áudio pula uma vez, ao soltar.
   * Trocar o nó de buffer a cada quadro do arrasto viraria ruído de rebobinar,
   * e ninguém quer ouvir rebobinar no meio de uma cena.
   */
  const aoDescer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekable || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setArrastando(true)
    pintar(posicaoDoPonteiro(e.clientX))
  }

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return
    pintar(posicaoDoPonteiro(e.clientX))
  }

  const aoSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return
    setArrastando(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    engine.seek(voice.id, posicaoDoPonteiro(e.clientX))
  }

  const aoCancelar = () => {
    if (!arrastando) return
    setArrastando(false)
    pintar(engine.position(voice.id))
  }

  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!seekable) return
    const atual = engine.position(voice.id)
    let alvo: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') alvo = atual - 5
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') alvo = atual + 5
    else if (e.key === 'PageDown') alvo = atual - SKIP
    else if (e.key === 'PageUp') alvo = atual + SKIP
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = voice.duration
    if (alvo === null) return
    e.preventDefault()
    engine.seek(voice.id, alvo)
    pintar(engine.position(voice.id))
  }

  const position = engine.position(voice.id)
  const ratio = seekable ? Math.min(1, position / voice.duration) : 0

  return (
    <li className="voice" data-paused={voice.paused || undefined}>
      <div className="voice__head">
        <span className="voice__name">{voice.name}</span>
        {voice.loop && (
          <span className="voice__badge" title="em loop">
            <LoopIcon size={12} />
            <span className="sr-only">em loop</span>
          </span>
        )}
        {voice.paused && <span className="voice__badge voice__badge--text">pausado</span>}
      </div>

      <div className="voice__progress">
        <div
          className="voice__scrub"
          ref={scrub}
          role="slider"
          tabIndex={seekable ? 0 : -1}
          aria-label={`Posição de ${voice.name}`}
          aria-valuemin={0}
          aria-valuemax={Math.floor(voice.duration)}
          aria-valuenow={Math.floor(position)}
          aria-valuetext={clock(position)}
          aria-disabled={seekable ? undefined : true}
          data-arrastando={arrastando || undefined}
          onPointerDown={aoDescer}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoCancelar}
          onKeyDown={aoTeclar}
        >
          <span className="voice__track" aria-hidden="true">
            <span className="voice__fill" ref={fill} style={{ transform: `scaleX(${ratio})` }} />
          </span>
          <span
            className="voice__knob"
            ref={knob}
            aria-hidden="true"
            style={{ left: `${ratio * 100}%` }}
          />
        </div>
        <span className="voice__time num" ref={time}>
          {remaining(position, voice.duration)}
        </span>
      </div>

      <div className="voice__controls">
        <button
          type="button"
          className="icon-btn"
          onClick={() => engine.nudge(voice.id, -SKIP)}
          aria-label={`Voltar ${SKIP} segundos em ${voice.name}`}
          title={`Voltar ${SKIP}s`}
        >
          <Back10Icon size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => (voice.paused ? engine.resume(voice.id) : engine.pause(voice.id))}
          aria-label={voice.paused ? `Retomar ${voice.name}` : `Pausar ${voice.name}`}
        >
          {voice.paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => engine.nudge(voice.id, SKIP)}
          aria-label={`Avançar ${SKIP} segundos em ${voice.name}`}
          title={`Avançar ${SKIP}s`}
        >
          <Fwd10Icon size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => engine.restart(voice.id)}
          aria-label={`Reiniciar ${voice.name}`}
        >
          <RestartIcon size={14} />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-active={voice.loop || undefined}
          onClick={() => engine.setVoiceLoop(voice.id, !voice.loop)}
          aria-pressed={voice.loop}
          aria-label={`Loop de ${voice.name}`}
        >
          <LoopIcon size={14} />
        </button>

        <label className="voice__volume">
          <span className="sr-only">Volume de {voice.name}</span>
          <input
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={voice.volume}
            onChange={(e) => engine.setVoiceVolume(voice.id, Number(e.target.value))}
          />
        </label>

        <button
          type="button"
          className="icon-btn icon-btn--stop"
          onClick={() => engine.stop(voice.id)}
          aria-label={`Parar ${voice.name}`}
        >
          <StopIcon size={12} />
        </button>
      </div>

      <span className="sr-only">duração {clock(voice.duration)}</span>
    </li>
  )
}
