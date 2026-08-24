import { useEffect, useRef, useState } from 'react'
import { repo } from '../data'
import type { PacoteRecebido } from '../data/repo'
import { useToasts } from '../state/toasts'
import { plural } from '../lib/format'
import { CloseIcon, SwapIcon, UploadIcon, WarnIcon } from '../icons'

/**
 * Mandar e receber o espetáculo inteiro como um arquivo.
 *
 * Quem monta e quem opera raramente são a mesma pessoa, e entre as duas
 * costuma haver uma cidade. Um `.sounddeck` é o espetáculo fechado numa mala —
 * roteiro e áudios juntos — que atravessa por Drive, WhatsApp ou pendrive.
 *
 * Fica no modo montar e em lugar nenhum mais. Trocar o deck inteiro é a coisa
 * mais destrutiva que o produto sabe fazer, e não pode estar ao alcance de um
 * clique distraído durante a peça.
 */

/** A ponte que o Electron instala. No navegador ela simplesmente não existe. */
declare global {
  interface Window {
    sounddeck?: { reabrir: () => void }
  }
}

type Fase = { estado: 'fechado' } | { estado: 'perguntando' } | { estado: 'pronto'; recebido: PacoteRecebido }

export function PacoteBar() {
  const { push } = useToasts()
  const escolher = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>({ estado: 'fechado' })
  const [ocupado, setOcupado] = useState(false)

  const exportar = async () => {
    setOcupado(true)
    try {
      const { blob, nome } = await repo.exportarPacote()
      baixar(blob, nome)
      push({ message: `“${nome}” pronto para enviar.`, tone: 'neutral' })
    } catch (erro) {
      push({ message: `Não deu para exportar: ${mensagem(erro)}`, tone: 'warn' })
    } finally {
      setOcupado(false)
    }
  }

  const importar = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setOcupado(true)
    try {
      const recebido = await repo.importarPacote(arquivo)
      setFase({ estado: 'pronto', recebido })
    } catch (erro) {
      push({ message: `Esse arquivo não entrou: ${mensagem(erro)}`, tone: 'warn' })
      setFase({ estado: 'fechado' })
    } finally {
      setOcupado(false)
      if (escolher.current) escolher.current.value = ''
    }
  }

  return (
    <div className="pacotebar">
      <span className="hint">
        O espetáculo inteiro — roteiro e áudios — cabe num arquivo só, para mandar a quem vai
        operar.
      </span>

      <button type="button" className="btn btn--ghost" onClick={exportar} disabled={ocupado}>
        <UploadIcon size={14} />
        Exportar espetáculo
      </button>

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setFase({ estado: 'perguntando' })}
        disabled={ocupado}
      >
        <SwapIcon size={14} />
        Trazer espetáculo
      </button>

      <input
        ref={escolher}
        type="file"
        accept=".sounddeck"
        className="sr-only"
        onChange={(e) => void importar(e.target.files?.[0])}
      />

      {fase.estado !== 'fechado' && (
        <TrazerDialog
          fase={fase}
          ocupado={ocupado}
          onEscolher={() => escolher.current?.click()}
          onClose={() => setFase({ estado: 'fechado' })}
        />
      )}
    </div>
  )
}

/**
 * O diálogo em duas fases: o aviso antes, o resultado depois.
 *
 * O aviso existe porque importar não tem desfazer na tela. O deck substituído
 * não é apagado — ele fica numa pasta ao lado, e o texto diz isso — mas
 * recuperá-lo de lá é trabalho de quem sabe onde procurar, e ninguém deveria
 * descobrir essa pasta por acidente.
 */
function TrazerDialog({
  fase,
  ocupado,
  onEscolher,
  onClose,
}: {
  fase: Fase
  ocupado: boolean
  onEscolher: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  const pronto = fase.estado === 'pronto' ? fase.recebido : null

  return (
    <dialog className="dialog" ref={ref} onClose={onClose} aria-labelledby="trazer-title">
      <div className="dialog__head">
        <h2 id="trazer-title" className="dialog__title">
          {pronto ? 'Espetáculo recebido' : 'Trazer um espetáculo'}
        </h2>
        <form method="dialog">
          <button type="submit" className="icon-btn" aria-label="Fechar">
            <CloseIcon size={14} />
          </button>
        </form>
      </div>

      {pronto ? (
        <>
          <p className="dialog__body">
            {pronto.pecas.length > 0 ? (
              <>
                Chegou <strong>{pronto.pecas.join('”, “')}</strong>
                {typeof pronto.audios === 'number' && (
                  <> com {plural(pronto.audios, 'áudio', 'áudios')}</>
                )}
                .
              </>
            ) : (
              <>O arquivo foi aceito.</>
            )}
          </p>
          <p className="dialog__note">
            Ele entra quando o SoundDeck reabrir — o roteiro só pode ser trocado com o programa
            fechado, e é isso que impede o deck de ser puxado debaixo de um áudio que está tocando.
          </p>
          <form method="dialog" className="dialog__acoes">
            <button type="submit" className="btn">
              Depois
            </button>
            {typeof window !== 'undefined' && window.sounddeck && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => window.sounddeck?.reabrir()}
              >
                Reabrir agora
              </button>
            )}
          </form>
        </>
      ) : (
        <>
          <p className="dialog__body">
            Escolha o arquivo <strong>.sounddeck</strong> que você recebeu. Ele traz o roteiro e os
            áudios juntos.
          </p>
          <p className="banner banner--warn dialog__aviso" role="note">
            <WarnIcon size={14} />
            <span>
              Isto <strong>substitui</strong> o espetáculo que está no deck agora. O anterior não é
              apagado: fica guardado na pasta <code>anterior</code>, dentro da pasta de dados do
              SoundDeck.
            </span>
          </p>
          <form method="dialog" className="dialog__acoes">
            <button type="submit" className="btn">
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={onEscolher} disabled={ocupado}>
              {ocupado ? 'Recebendo…' : 'Escolher o arquivo'}
            </button>
          </form>
        </>
      )}
    </dialog>
  )
}

/** Entrega o arquivo ao sistema. No aplicativo, abre a janela de salvar. */
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Sem a folga o Chromium revoga a URL antes de terminar de ler o blob, e o
  // download sai truncado — num espetáculo, com os áudios pela metade.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'erro desconhecido'
}
