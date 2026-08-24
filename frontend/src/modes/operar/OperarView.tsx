import { useMemo, useState } from 'react'
import type { Cue, Scene, Voice } from '../../types'
import { useDeck } from '../../state/deck'
import { useShortcuts } from '../../state/shortcuts'
import { useFired, useStatuses, useVoices } from '../../audio/useEngine'
import { engine } from '../../audio/engine'
import { plural } from '../../lib/format'
import { CueButton } from './CueButton'
import { SceneRail } from './SceneRail'
import { NowPlaying } from './NowPlaying'
import { DownIcon, UpIcon, WarnIcon } from '../../icons'

/**
 * Modo OPERAR — a tela do espetáculo.
 *
 * Só disparo. Nenhum botão de excluir, renomear ou reordenar existe aqui:
 * nada destrutivo perto do dedo que opera. O único botão perigoso na tela é o
 * PARAR TUDO, e ele mora na faixa fixa, fora deste componente.
 */

type Props = {
  scene: Scene | null
  scenes: Scene[]
  onSelectScene: (id: string) => void
  onGoMontar: () => void
}

export function OperarView({ scene, scenes, onSelectScene, onGoMontar }: Props) {
  const { cuesOf, audioOf } = useDeck()
  const voices = useVoices()
  const statuses = useStatuses()
  const fired = useFired()
  const [collapsed, setCollapsed] = useState(false)

  const cues = scene ? cuesOf(scene.id) : []

  const voicesByCue = useMemo(() => {
    const map = new Map<string, Voice[]>()
    for (const voice of voices) {
      const list = map.get(voice.cueId)
      if (list) list.push(voice)
      else map.set(voice.cueId, [voice])
    }
    return map
  }, [voices])

  const liveSceneIds = useMemo(() => {
    const byCueId = new Map(
      scenes.flatMap((s) => cuesOf(s.id).map((c) => [c.id, s.id] as const)),
    )
    return new Set(voices.map((v) => byCueId.get(v.cueId)).filter(Boolean) as string[])
  }, [voices, scenes, cuesOf])

  const failures = cues.filter((c) => statuses[c.audioId]?.state === 'failed')

  const fire = (cue: Cue) => {
    const audio = audioOf(cue.audioId)
    engine.fire(cue, audio?.name ?? 'Áudio')
  }

  const keymap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cue of cues) if (cue.key) map.set(cue.key.toLowerCase(), cue.id)
    return map
  }, [cues])

  useShortcuts({
    enabled: true,
    keymap,
    fire: (cueId) => {
      const cue = cues.find((c) => c.id === cueId)
      if (cue) fire(cue)
    },
    stopAll: () => engine.stopAll(),
    togglePauseAll: () => engine.togglePauseAll(),
    moveScene: (delta) => {
      if (!scene) return
      const index = scenes.findIndex((s) => s.id === scene.id)
      const next = scenes[Math.min(scenes.length - 1, Math.max(0, index + delta))]
      if (next) onSelectScene(next.id)
    },
  })

  return (
    <div className="stage" data-now={voices.length > 0 ? 'on' : 'off'}>
      <SceneRail
        scenes={scenes}
        activeId={scene?.id ?? null}
        countOf={(id) => cuesOf(id).length}
        liveIn={(id) => liveSceneIds.has(id)}
        onSelect={onSelectScene}
      />

      <section className="deck" aria-label={scene ? `Cues da cena ${scene.name}` : 'Cues'}>
        <header className="deck__head">
          <h1 className="deck__title">{scene?.name ?? 'Sem cena'}</h1>
          <span className="deck__count num">{plural(cues.length, 'cue', 'cues')}</span>
          {failures.length > 0 && (
            <p className="deck__failures" role="status">
              <WarnIcon size={14} />
              {plural(failures.length, 'áudio não carregou', 'áudios não carregaram')} — confira na
              biblioteca antes de começar
            </p>
          )}
        </header>

        {cues.length === 0 ? (
          <div className="empty">
            <p className="empty__title">Nenhum cue nesta cena ainda</p>
            <p className="empty__body">
              Cues são o que você dispara durante a peça: um áudio da biblioteca mais a deixa que
              manda tocá-lo.
            </p>
            <button type="button" className="btn btn--primary" onClick={onGoMontar}>
              Montar esta cena
            </button>
          </div>
        ) : (
          <div className="grid">
            {cues.map((cue) => (
              <CueButton
                key={cue.id}
                cue={cue}
                audio={audioOf(cue.audioId)}
                status={statuses[cue.audioId] ?? null}
                voices={voicesByCue.get(cue.id) ?? []}
                fired={fired.has(cue.id)}
                onFire={() => fire(cue)}
              />
            ))}
          </div>
        )}
      </section>

      {voices.length > 0 && (
        <div className="now-slot" data-collapsed={collapsed || undefined}>
          <button
            type="button"
            className="now__toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? <UpIcon size={14} /> : <DownIcon size={14} />}
            <span className="sr-only">
              {collapsed ? 'Expandir tocando agora' : 'Recolher tocando agora'}
            </span>
          </button>
          <NowPlaying voices={voices} />
        </div>
      )}
    </div>
  )
}
