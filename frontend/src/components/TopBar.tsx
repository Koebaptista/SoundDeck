import { engine } from '../audio/engine'
import { useMasterVolume, useStatuses } from '../audio/useEngine'
import { plural } from '../lib/format'
import { SpeakerIcon, WarnIcon } from '../icons'

/**
 * Barra superior: em que modo estamos, quanto está armado, volume geral.
 *
 * O resumo de armação fica sempre visível porque é a pergunta que o operador
 * faz antes de começar — "o deck está pronto?". A resposta não pode exigir um
 * clique.
 */

type Mode = 'operar' | 'montar'

export function TopBar({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  const statuses = useStatuses()
  const master = useMasterVolume()

  const list = Object.values(statuses)
  const failed = list.filter((s) => s.state === 'failed').length
  const arming = list.filter((s) => s.state === 'arming').length
  const ready = list.filter((s) => s.state === 'ready').length

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark">SoundDeck</span>
        <span
          className="topbar__armed"
          data-tone={failed > 0 ? 'warn' : arming > 0 ? 'busy' : 'ok'}
          role="status"
        >
          {failed > 0 && <WarnIcon size={13} />}
          {arming > 0
            ? `armando ${arming}…`
            : failed > 0
              ? `${plural(failed, 'áudio não carregou', 'áudios não carregaram')}`
              : `${plural(ready, 'áudio armado', 'áudios armados')}`}
        </span>
      </div>

      <div className="segmented" role="group" aria-label="Modo de trabalho">
        <button
          type="button"
          className="segmented__item"
          aria-pressed={mode === 'operar'}
          onClick={() => onMode('operar')}
        >
          Operar
        </button>
        <button
          type="button"
          className="segmented__item"
          aria-pressed={mode === 'montar'}
          onClick={() => onMode('montar')}
        >
          Montar
        </button>
      </div>

      <div className="topbar__right">
        <label className="master">
          <SpeakerIcon size={15} />
          <span className="sr-only">Volume geral</span>
          <input
            className="range master__range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master}
            onChange={(e) => engine.setMaster(Number(e.target.value))}
          />
          <span className="master__value num">{Math.round(master * 100)}%</span>
        </label>
      </div>
    </header>
  )
}
