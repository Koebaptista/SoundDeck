import { useRef } from 'react'
import type { AssetStatus, AudioAsset, Cue, Voice } from '../../types'
import { engine } from '../../audio/engine'
import { useAnimationFrame } from '../../audio/useEngine'
import { duration as fmtDuration, remaining } from '../../lib/format'
import { WarnIcon } from '../../icons'

/**
 * O botão de disparo. É a peça central do produto inteiro.
 *
 * Lido de relance, com o olhar vindo do palco, em menos de um segundo. Por
 * isso o nome é o maior elemento, a deixa vem logo abaixo (é o que o operador
 * realmente procura, já que está olhando para a cena) e o resto é discreto.
 *
 * "Tocando" nunca é só cor: preenchimento, borda, barra de progresso andando,
 * tempo regressivo e a palavra "Tocando". Quatro sinais além da cor.
 */

type Props = {
  cue: Cue
  audio: AudioAsset | undefined
  status: AssetStatus | null
  voices: Voice[]
  fired: boolean
  onFire: () => void
}

export function CueButton({ cue, audio, status, voices, fired, onFire }: Props) {
  const active = voices[voices.length - 1] ?? null
  const paused = active?.paused ?? false
  const armState = status?.state ?? 'arming'

  const state =
    armState === 'failed'
      ? 'failed'
      : armState !== 'ready'
        ? 'arming'
        : active
          ? paused
            ? 'paused'
            : 'playing'
          : 'ready'

  const duration = status?.duration || audio?.duration || 0

  if (state === 'arming') {
    return (
      <div className="cue cue--arming" aria-hidden="true">
        <span className="cue__skeleton cue__skeleton--name" />
        <span className="cue__skeleton cue__skeleton--cue" />
        <span className="cue__skeleton cue__skeleton--meta" />
      </div>
    )
  }

  const label =
    state === 'failed'
      ? 'não carregou'
      : state === 'playing'
        ? voices.length > 1
          ? `tocando, ${voices.length} vozes`
          : 'tocando'
        : state === 'paused'
          ? 'pausado'
          : 'pronto'

  return (
    <button
      type="button"
      className="cue"
      data-state={state}
      onClick={onFire}
      disabled={state === 'failed'}
      aria-label={`${audio?.name ?? 'Áudio ausente'} — ${cue.cue || 'sem deixa'} — ${label}`}
    >
      <span className="cue__corner">
        {fired && (
          <span className="cue__fired" title="já disparado nesta sessão">
            <span className="sr-only">já disparado nesta sessão</span>
          </span>
        )}
        {cue.key && <kbd className="cue__key num">{cue.key}</kbd>}
      </span>

      <span className="cue__name">{audio?.name ?? 'Áudio ausente'}</span>

      {cue.cue ? (
        <span className="cue__deixa">{cue.cue}</span>
      ) : (
        <span className="cue__deixa cue__deixa--none">sem deixa anotada</span>
      )}

      <span className="cue__meta">
        <span className="cue__state" data-state={state}>
          {state === 'failed' && <WarnIcon size={13} />}
          {state === 'playing' && <span className="cue__pulse" aria-hidden="true" />}
          {label}
        </span>
        {/* Palavra, não glifo: a 13px, no escuro e de relance, "loop" se lê e
            um ícone de setas se interpreta. */}
        {cue.loop && <span className="cue__loop">loop</span>}
        <TimeReadout voice={active} duration={duration} paused={paused} />
      </span>

      {state === 'failed' && status?.error && <span className="cue__error">{status.error}</span>}

      {(state === 'playing' || state === 'paused') && active && (
        <Progress voiceId={active.id} duration={duration} running={!paused} />
      )}
    </button>
  )
}

/**
 * Tempo e barra vivem fora do estado do React: o valor é escrito direto no DOM
 * a cada quadro. Sessenta cues não podem re-renderizar sessenta vezes por
 * segundo só para mover um pixel.
 */
function TimeReadout({
  voice,
  duration,
  paused,
}: {
  voice: Voice | null
  duration: number
  paused: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useAnimationFrame(Boolean(voice) && !paused, () => {
    if (!ref.current || !voice) return
    ref.current.textContent = remaining(engine.position(voice.id), duration)
  })

  const initial = voice ? remaining(engine.position(voice.id), duration) : fmtDuration(duration)
  return (
    <span className="cue__time num" ref={ref}>
      {initial}
    </span>
  )
}

function Progress({
  voiceId,
  duration,
  running,
}: {
  voiceId: string
  duration: number
  running: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useAnimationFrame(running, () => {
    if (!ref.current || duration <= 0) return
    const ratio = Math.min(1, engine.position(voiceId) / duration)
    ref.current.style.transform = `scaleX(${ratio})`
  })

  const initial = duration > 0 ? Math.min(1, engine.position(voiceId) / duration) : 0

  return (
    <span className="cue__track" aria-hidden="true">
      <span className="cue__fill" ref={ref} style={{ transform: `scaleX(${initial})` }} />
    </span>
  )
}
