import { useRef, useState } from 'react'
import type { AudioAsset } from '../../types'
import { repo } from '../../data'
import { useDeck } from '../../state/deck'
import { useToasts } from '../../state/toasts'
import { useStatuses } from '../../audio/useEngine'
import { engine } from '../../audio/engine'
import { bytes, duration as fmtDuration, plural } from '../../lib/format'
import { InlineText } from '../../components/InlineText'
import { CheckIcon, PlayIcon, TrashIcon, UploadIcon, WarnIcon } from '../../icons'

/**
 * Biblioteca de áudios.
 *
 * É aqui que o estado de falha precisa gritar: um arquivo que não carrega tem
 * de ser descoberto na montagem, nunca no meio da peça. Por isso cada áudio
 * mostra abertamente o que está armado, como vai tocar e o que falhou.
 */

export function LibraryPanel() {
  const { deck, run } = useDeck()
  const { push } = useToasts()
  const statuses = useStatuses()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)

  const cuesUsing = (audioId: string) => deck.cues.filter((c) => c.audioId === audioId).length

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted = [...files].filter((f) => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.name))
    const skipped = files.length - accepted.length
    setRejected(
      skipped > 0
        ? `${plural(skipped, 'arquivo ignorado', 'arquivos ignorados')} — só entram arquivos de áudio`
        : null,
    )
    if (accepted.length === 0) return
    setBusy(true)
    for (const file of accepted) await run(() => repo.addAudio(file))
    setBusy(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const remove = async (audio: AudioAsset) => {
    const used = cuesUsing(audio.id)
    const result = await run(() => repo.deleteAudio(audio.id))
    if (!result) return
    push({
      message:
        used > 0
          ? `"${audio.name}" removido, junto com ${plural(used, 'cue', 'cues')} que o usavam.`
          : `"${audio.name}" removido da biblioteca.`,
      tone: 'warn',
      action: {
        label: 'Desfazer',
        run: () => void run(() => repo.restoreAudio(result.audio, result.cues)),
      },
    })
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Biblioteca</h2>
        <p className="panel__hint">
          Todo áudio é carregado na abertura do deck. Os curtos ficam decodificados na memória; os
          longos tocam por streaming.
        </p>
      </header>

      {deck.audios.length === 0 ? (
        <div className="empty empty--inline">
          <p className="empty__title">Nenhum áudio na biblioteca</p>
          <p className="empty__body">
            Envie os arquivos do espetáculo. Eles ficam disponíveis para qualquer cena.
          </p>
        </div>
      ) : (
        <ul className="rows">
          {deck.audios.map((audio) => {
            const status = statuses[audio.id]
            const state = status?.state ?? 'arming'
            const used = cuesUsing(audio.id)
            return (
              <li className="audio" key={audio.id} data-state={state}>
                <div className="audio__main">
                  <div className="audio__namefield">
                    <InlineText
                      label={`Nome do áudio ${audio.name}`}
                      value={audio.name}
                      required
                      className="audio__name"
                      onCommit={(name) => void run(() => repo.updateAudio(audio.id, { name }))}
                    />
                  </div>
                  <div className="audio__descfield">
                    <InlineText
                      label={`Descrição de ${audio.name}`}
                      value={audio.description}
                      placeholder="Descrição — como soa, de onde veio"
                      onCommit={(description) =>
                        void run(() => repo.updateAudio(audio.id, { description }))
                      }
                    />
                  </div>
                </div>

                {/* Uma linha de metadados em vez de três rótulos empilhados: a
                    biblioteca cresce com o espetáculo e precisa caber na tela. */}
                <p className="audio__meta">
                  <span className="num">
                    <span className="sr-only">duração </span>
                    {fmtDuration(status?.duration || audio.duration)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {audio.format}
                    {audio.size ? ` · ${bytes(audio.size)}` : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="num">
                    <span className="sr-only">em uso em </span>
                    {plural(used, 'cue', 'cues')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="audio__status" data-state={state}>
                    {state === 'ready' && (
                      <>
                        <CheckIcon size={13} />
                        armado · {status?.strategy === 'buffer' ? 'memória' : 'streaming'}
                      </>
                    )}
                    {state === 'arming' && <>armando…</>}
                    {state === 'failed' && (
                      <>
                        <WarnIcon size={13} />
                        {status?.error ?? 'não carregou'}
                      </>
                    )}
                  </span>
                </p>

                <div className="audio__actions">
                  {state === 'failed' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void engine.rearm(audio.id)}
                    >
                      Tentar de novo
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={state !== 'ready'}
                      onClick={() =>
                        engine.fire(
                          {
                            id: `preview-${audio.id}`,
                            sceneId: '',
                            audioId: audio.id,
                            cue: '',
                            order: 0,
                            key: null,
                            volume: 1,
                            loop: false,
                          },
                          audio.name,
                        )
                      }
                    >
                      <PlayIcon size={12} />
                      Ouvir
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => void remove(audio)}
                    aria-label={`Remover ${audio.name} da biblioteca`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="addbar">
        <input
          ref={fileInput}
          id="library-upload"
          className="sr-only"
          type="file"
          accept="audio/*"
          multiple
          onChange={(e) => void upload(e.target.files)}
        />
        <label className="btn btn--primary" htmlFor="library-upload" aria-disabled={busy}>
          <UploadIcon size={14} />
          {busy ? 'Enviando…' : 'Enviar áudio'}
        </label>
        <p className="hint">WAV, MP3, OGG, M4A ou FLAC. Ficam guardados neste computador.</p>
      </div>

      {rejected && (
        <p className="error-text" role="status">
          <WarnIcon size={13} />
          {rejected}
        </p>
      )}
    </section>
  )
}
