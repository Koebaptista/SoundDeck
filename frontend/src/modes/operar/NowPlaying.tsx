import { useRef } from 'react'
import type { Voice } from '../../types'
import { engine } from '../../audio/engine'
import { useAnimationFrame } from '../../audio/useEngine'
import { clock, remaining } from '../../lib/format'
import { LoopIcon, PauseIcon, PlayIcon, RestartIcon, StopIcon } from '../../icons'

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
  const fill = useRef<HTMLSpanElement>(null)
  const time = useRef<HTMLSpanElement>(null)

  useAnimationFrame(!voice.paused, () => {
    const position = engine.position(voice.id)
    if (fill.current && voice.duration > 0) {
      fill.current.style.transform = `scaleX(${Math.min(1, position / voice.duration)})`
    }
    if (time.current) time.current.textContent = remaining(position, voice.duration)
  })

  const position = engine.position(voice.id)
  const ratio = voice.duration > 0 ? Math.min(1, position / voice.duration) : 0

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
        <span className="voice__track" aria-hidden="true">
          <span className="voice__fill" ref={fill} style={{ transform: `scaleX(${ratio})` }} />
        </span>
        <span className="voice__time num" ref={time}>
          {remaining(position, voice.duration)}
        </span>
      </div>

      <div className="voice__controls">
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
