import { useEffect, useMemo, useState } from 'react'
import { useDeck, useSelection } from './state/deck'
import { useAudioLocked } from './audio/useEngine'
import { engine } from './audio/engine'
import { repo, usingMock } from './data'
import { emptyMock, resetMock } from './data/mockRepo'
import { TopBar } from './components/TopBar'
import { ProgramBar } from './components/ProgramBar'
import { StopAll } from './components/StopAll'
import { ToastRegion } from './components/ToastRegion'
import { FirstRun } from './components/FirstRun'
import { OperarView } from './modes/operar/OperarView'
import { MontarView, type MontarTab } from './modes/montar/MontarView'
import { CloseIcon, WarnIcon } from './icons'

/**
 * Casca do produto: barra superior, contexto, palco, faixa de parar.
 *
 * A faixa `PARAR TUDO` fica fora dos modos de propósito: vale também no modo
 * montar, onde o operador testa cues e pode precisar interromper tudo do mesmo
 * jeito. A única tela sem ela é a de projeto vazio, onde não existe áudio
 * algum para parar.
 */

type Mode = 'operar' | 'montar'

export function App() {
  const { status, error, deck, cuesOf, reload, writeError, dismissWriteError } = useDeck()
  const [mode, setMode] = useState<Mode>('operar')
  // A aba do montar mora aqui porque não é só o montar que a escolhe: o
  // seletor de peça manda abrir "Dias" quando a peça escolhida não tem
  // nenhum, e essa é a única saída do beco.
  const [montarTab, setMontarTab] = useState<MontarTab>('cenas')
  const { show, day, scene, days, scenes, selectShow, selectDay, selectScene } = useSelection(deck)
  const locked = useAudioLocked()

  // O navegador só libera áudio depois de um gesto. Qualquer gesto serve, e
  // esta é a única razão pela qual o deck escuta o documento inteiro.
  useEffect(() => {
    const unlock = () => void engine.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const cueCount = useMemo(
    () => scenes.reduce((total, item) => total + cuesOf(item.id).length, 0),
    [scenes, cuesOf],
  )

  /** Projeto recém-instalado: nem peça, nem áudio. */
  const bare = status === 'ready' && deck.shows.length === 0 && deck.audios.length === 0
  // O primeiro uso só toma a tela no modo operar. No montar ele atrapalharia
  // justamente quem já clicou em "começar a montar".
  const firstRun = bare && mode === 'operar'

  return (
    <div className="shell" data-mode={mode}>
      <TopBar mode={mode} onMode={setMode} />

      {status === 'ready' && !firstRun && show && (
        <ProgramBar
          mode={mode}
          show={show}
          days={days}
          day={day}
          sceneCount={scenes.length}
          cueCount={cueCount}
          onSelectShow={selectShow}
          onSelectDay={selectDay}
          onEditDays={() => {
            setMode('montar')
            setMontarTab('dias')
          }}
        />
      )}

      {locked && (
        <div className="banner banner--warn" role="status">
          <WarnIcon size={14} />
          <p>
            O navegador ainda não liberou o áudio. Clique em qualquer lugar da tela antes de começar
            — nenhum cue toca até lá.
          </p>
          <button type="button" className="btn" onClick={() => void engine.unlock()}>
            Liberar áudio
          </button>
        </div>
      )}

      {writeError && (
        <div className="banner banner--warn" role="alert">
          <WarnIcon size={14} />
          <p>{writeError}</p>
          <button
            type="button"
            className="icon-btn"
            onClick={dismissWriteError}
            aria-label="Dispensar"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      )}

      {status === 'loading' && <DeckSkeleton />}

      {status === 'error' && (
        <div className="empty empty--full">
          <p className="empty__title">Não foi possível abrir o projeto</p>
          <p className="empty__body">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => void reload()}>
            Tentar de novo
          </button>
        </div>
      )}

      {firstRun && (
        <FirstRun
          onStart={() => setMode('montar')}
          onSeed={
            usingMock
              ? () => {
                  resetMock()
                  void reload()
                }
              : () => void repo.load().then(() => reload())
          }
        />
      )}

      {status === 'ready' &&
        !firstRun &&
        (mode === 'operar' ? (
          <OperarView
            scene={scene}
            scenes={scenes}
            onSelectScene={selectScene}
            onGoMontar={() => setMode('montar')}
          />
        ) : (
          <MontarView
            tab={montarTab}
            onTab={setMontarTab}
            show={show}
            day={day}
            days={days}
            scene={scene}
            scenes={scenes}
            onSelectShow={selectShow}
            onSelectDay={selectDay}
            onSelectScene={selectScene}
          />
        ))}

      {usingMock && mode === 'montar' && (
        <div className="mockbar">
          <span className="hint">
            Dados de exemplo, guardados neste navegador — o backend Django ainda não está ligado.
          </span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              resetMock()
              void reload()
            }}
          >
            Restaurar exemplo
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              emptyMock()
              void reload()
            }}
          >
            Esvaziar projeto
          </button>
        </div>
      )}

      {/* Sem um único áudio no projeto, nada pode tocar — e um botão de pânico
          que nunca terá o que fazer só rouba a atenção do primeiro passo. */}
      {!bare && <StopAll />}
      <ToastRegion />
    </div>
  )
}

/** Esqueleto na forma do conteúdo. Sem spinner no meio da tela. */
function DeckSkeleton() {
  return (
    <div className="stage" data-now="off" aria-busy="true" aria-label="Armando o deck">
      <div className="rail">
        <h2 className="rail__title">Cenas</h2>
        <div className="rail__list">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="skeleton skeleton--rail" />
          ))}
        </div>
      </div>
      <div className="deck">
        <div className="grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="cue cue--arming">
              <span className="cue__skeleton cue__skeleton--name" />
              <span className="cue__skeleton cue__skeleton--cue" />
              <span className="cue__skeleton cue__skeleton--meta" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
