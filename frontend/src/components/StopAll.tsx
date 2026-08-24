import { engine } from '../audio/engine'
import { useVoices } from '../audio/useEngine'
import { plural } from '../lib/format'

/**
 * PARAR TUDO — faixa fixa, de borda a borda, sempre presente.
 *
 * É o único botão perigoso da tela durante a peça, e é perigoso de propósito.
 * Em repouso fica contornado; quando há som no ar ele se preenche de vermelho
 * sólido, porque só então tem o que fazer. A contagem diz quantas vozes vão
 * cair no clique.
 */

export function StopAll() {
  const voices = useVoices()
  const armed = voices.length > 0

  return (
    <div className="stopbar">
      <button
        type="button"
        className="stopall"
        data-armed={armed || undefined}
        onClick={() => engine.stopAll()}
        aria-label={
          armed
            ? `Parar tudo — ${plural(voices.length, 'áudio tocando', 'áudios tocando')}`
            : 'Parar tudo — nada tocando'
        }
      >
        <span className="stopall__label">Parar tudo</span>
        {armed && (
          <span className="stopall__count num" aria-hidden="true">
            {voices.length}
          </span>
        )}
      </button>
    </div>
  )
}
