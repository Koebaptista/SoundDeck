import { useMemo, useState } from 'react'
import type { Cue, Day, Scene } from '../../types'
import { repo } from '../../data'
import { blurOnWheel } from '../../lib/select'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { useStatuses } from '../../audio/useEngine'
import { engine } from '../../audio/engine'
import { duration as fmtDuration } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { KeyField } from '../../components/KeyField'
import { DownIcon, PlayIcon, PlusIcon, TrashIcon, UpIcon, WarnIcon } from '../../icons'

/**
 * Cues da cena ativa.
 *
 * O cue liga um áudio da biblioteca a uma deixa e carrega a configuração de
 * disparo — tecla, volume, loop. O mesmo áudio pode aparecer em várias cenas
 * com configurações diferentes; quem guarda a diferença é o cue.
 */

type Props = {
  day: Day | null
  scene: Scene | null
  scenes: Scene[]
  onSelectScene: (id: string) => void
  onGoLibrary: () => void
  onGoScenes: () => void
}

export function CuesPanel({ day, scene, scenes, onSelectScene, onGoLibrary, onGoScenes }: Props) {
  const { deck, cuesOf, audioOf, run } = useDeck()
  const { push } = useToasts()
  const statuses = useStatuses()
  const [newAudioId, setNewAudioId] = useState('')

  const cues = scene ? cuesOf(scene.id) : []

  /** Teclas repetidas dentro da mesma cena: uma delas nunca vai disparar. */
  const duplicated = useMemo(() => {
    const seen = new Map<string, number>()
    for (const cue of cues) {
      if (cue.key) seen.set(cue.key, (seen.get(cue.key) ?? 0) + 1)
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([key]) => key))
  }, [cues])

  if (scenes.length === 0) {
    return (
      <section className="panel">
        <div className="empty empty--inline">
          <p className="empty__title">
            {day ? `Nenhuma cena em “${day.name}”` : 'Crie uma cena primeiro'}
          </p>
          <p className="empty__body">Cues moram dentro de cenas — sem cena não há onde guardá-los.</p>
          <button type="button" className="btn btn--primary" onClick={onGoScenes}>
            Ir para cenas
          </button>
        </div>
      </section>
    )
  }

  const move = async (index: number, delta: number) => {
    if (!scene) return
    const next = [...cues]
    const a = next[index]
    const b = next[index + delta]
    if (!a || !b) return
    next[index] = b
    next[index + delta] = a
    await run(() => repo.reorderCues(scene.id, next.map((c) => c.id)))
  }

  const remove = async (cue: Cue) => {
    const name = audioOf(cue.audioId)?.name ?? 'Cue'
    const removed = await run(() => repo.deleteCue(cue.id))
    if (!removed) return
    push({
      message: `"${name}" removido desta cena.`,
      tone: 'warn',
      action: { label: 'Desfazer', run: () => void run(() => repo.restoreCues([removed])) },
    })
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!scene || !newAudioId) return
    await run(() =>
      repo.createCue({
        sceneId: scene.id,
        audioId: newAudioId,
        cue: '',
        key: null,
        volume: 1,
        loop: false,
      }),
    )
    setNewAudioId('')
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Cues da cena</h2>
        <label className="panel__scene">
          <span className="sr-only">Cena em edição</span>
          <select
            className="select"
            value={scene?.id ?? ''}
            onWheel={blurOnWheel}
            onChange={(e) => onSelectScene(e.target.value)}
          >
            {scenes.map((s, i) => (
              <option key={s.id} value={s.id}>
                {String(i + 1).padStart(2, '0')} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <p className="panel__hint">
          {day && <>Roteiro de “{day.name}”. </>}A deixa é o que o operador procura durante a peça — escreva o que acontece no palco, não o
          nome do arquivo.
        </p>
      </header>

      {deck.audios.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">A biblioteca está vazia</p>
          <p className="empty__body">Envie um áudio antes de montar cues.</p>
          <button type="button" className="btn btn--primary" onClick={onGoLibrary}>
            Ir para a biblioteca
          </button>
        </div>
      ) : cues.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhum cue nesta cena ainda</p>
          <p className="empty__body">Escolha um áudio abaixo para criar o primeiro.</p>
        </div>
      ) : (
        <ol className="rows">
          {cues.map((cue, index) => {
            const audio = audioOf(cue.audioId)
            const status = statuses[cue.audioId]
            const failed = status?.state === 'failed'
            return (
              <li className="cuerow" key={cue.id}>
                <span className="cuerow__num num">{String(index + 1).padStart(2, '0')}</span>

                <div className="cuerow__body">
                  <div className="cuerow__line">
                    <label className="cuerow__audio">
                      <span className="sr-only">Áudio do cue {index + 1}</span>
                      <select
                        className="select"
                        value={cue.audioId}
                        onWheel={blurOnWheel}
                        onChange={(e) =>
                          void run(() => repo.updateCue(cue.id, { audioId: e.target.value }))
                        }
                      >
                        {deck.audios.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <KeyField
                      value={cue.key}
                      duplicated={Boolean(cue.key && duplicated.has(cue.key))}
                      onChange={(key) => void run(() => repo.updateCue(cue.id, { key }))}
                    />

                    <div className="row__actions">
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={index === 0}
                        onClick={() => void move(index, -1)}
                        aria-label={`Mover cue ${index + 1} para cima`}
                      >
                        <UpIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={index === cues.length - 1}
                        onClick={() => void move(index, 1)}
                        aria-label={`Mover cue ${index + 1} para baixo`}
                      >
                        <DownIcon size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => void remove(cue)}
                        aria-label={`Remover cue ${index + 1}`}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  <InlineText
                    label={`Deixa do cue ${index + 1}`}
                    value={cue.cue}
                    placeholder="Deixa: o que acontece em cena"
                    onCommit={(value) => void run(() => repo.updateCue(cue.id, { cue: value }))}
                  />

                  <div className="cuerow__line cuerow__line--tight">
                    <label className="cuerow__volume">
                      <span className="cuerow__label">Volume</span>
                      <input
                        className="range"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={cue.volume}
                        onChange={(e) =>
                          void run(() =>
                            repo.updateCue(cue.id, { volume: Number(e.target.value) }),
                          )
                        }
                      />
                      <span className="cuerow__value num">{Math.round(cue.volume * 100)}%</span>
                    </label>

                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={cue.loop}
                        onChange={(e) =>
                          void run(() => repo.updateCue(cue.id, { loop: e.target.checked }))
                        }
                      />
                      Loop
                    </label>

                    <span className="cuerow__dur num">
                      {fmtDuration(status?.duration || audio?.duration || 0)}
                    </span>

                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={failed || status?.state !== 'ready'}
                      onClick={() => engine.fire(cue, audio?.name ?? 'Áudio')}
                    >
                      <PlayIcon size={12} />
                      Testar
                    </button>
                  </div>

                  {failed && (
                    <p className="error-text">
                      <WarnIcon size={13} />
                      {status?.error ?? 'o áudio não carregou'} — resolva na biblioteca
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {deck.audios.length > 0 && (
        <form className="addbar" onSubmit={add}>
          <label className="row__grow">
            <span className="sr-only">Áudio do novo cue</span>
            <select
              className="select"
              value={newAudioId}
              onChange={(e) => setNewAudioId(e.target.value)}
            >
              <option value="">Escolha um áudio…</option>
              {deck.audios.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary" disabled={!newAudioId}>
            <PlusIcon size={14} />
            Adicionar cue
          </button>
        </form>
      )}
    </section>
  )
}
