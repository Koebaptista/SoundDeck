import type { AudioAsset, AssetStatus, Cue, Voice } from '../types'

/**
 * Engine de áudio do deck.
 *
 * A exigência é uma só: entre o clique e o som não pode haver espera
 * perceptível. Isso se resolve antes da peça, não durante — todo áudio é
 * carregado e decodificado no `arm()`, e o disparo só monta nós já prontos.
 *
 * Vive fora do React de propósito. React assina mudanças de conjunto de vozes
 * (disparo, pausa, fim); o progresso é lido por quem desenha, em
 * `requestAnimationFrame`, sem passar por estado.
 */

/** Acima disso, decodificar em memória custa centenas de MB sem ganho audível. */
const LONG_AUDIO_SECONDS = 45

/** Rampa anti-estalo. Cortar uma onda no meio produz um clique nas caixas. */
const RAMP = 0.015

/** Fade de entrada, curto o bastante para não atrasar o ataque. */
const ATTACK = 0.003

/** Salto dos botões de avanço e retrocesso, em segundos. */
export const SKIP = 10

type Entry = {
  asset: AudioAsset
  status: AssetStatus
  buffer: AudioBuffer | null
}

type LiveVoice = Voice & {
  gain: GainNode
  /** Nó de buffer: latência de milissegundos e polifonia real do mesmo som. */
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  /** Streaming para áudios longos, um elemento por voz. */
  element: HTMLAudioElement | null
  mediaNode: MediaElementAudioSourceNode | null
  /** `ctx.currentTime` do início do trecho atual. */
  startedAt: number
  /** Deslocamento dentro do áudio quando o trecho atual começou. */
  offset: number
  /** Deslocamento congelado enquanto pausado — buffer não tem pausa nativa. */
  pausedAt: number
  ended: boolean
}

export type EngineListener = () => void

let voiceSeq = 0

export class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private entries = new Map<string, Entry>()
  private voices = new Map<string, LiveVoice>()
  private listeners = new Set<EngineListener>()

  private voicesSnapshot: Voice[] = []
  private statusSnapshot: Record<string, AssetStatus> = {}
  private firedSnapshot: ReadonlySet<string> = new Set()

  private fired = new Set<string>()
  private master = 0.85
  private locked = true

  /* ---------------- contexto ---------------- */

  /**
   * O contexto nasce suspenso pela política de autoplay do navegador. Criamos
   * cedo mesmo assim: o grafo fica montado e `resume()` no primeiro gesto é
   * praticamente instantâneo.
   */
  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' })
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.master
      this.masterGain.connect(this.ctx.destination)
      this.locked = this.ctx.state !== 'running'
    }
    return this.ctx
  }

  /** Chamado no primeiro gesto do operador. Idempotente. */
  async unlock(): Promise<void> {
    const ctx = this.context()
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        /* segue travado; a interface avisa */
      }
    }
    const locked = ctx.state !== 'running'
    if (locked !== this.locked) {
      this.locked = locked
      this.emit()
    }
  }

  isLocked(): boolean {
    return this.locked
  }

  /** Latência de saída do dispositivo, em ms. Diagnóstico honesto para o operador. */
  outputLatency(): number {
    const ctx = this.ctx
    if (!ctx) return 0
    const base = ctx.baseLatency ?? 0
    const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0
    return Math.round((base + out) * 1000)
  }

  /* ---------------- preparação ---------------- */

  /**
   * Carrega e decodifica tudo. Curtos viram `AudioBuffer`; longos ficam em
   * `HTMLAudioElement` com `preload="auto"`. Erros não interrompem o resto:
   * cada áudio guarda o próprio motivo de falha para a interface mostrar.
   */
  async arm(assets: AudioAsset[]): Promise<void> {
    const keep = new Set(assets.map((a) => a.id))
    for (const id of [...this.entries.keys()]) {
      if (!keep.has(id)) this.entries.delete(id)
    }

    const pending: Promise<void>[] = []
    for (const asset of assets) {
      // Já pronto ou já em andamento: não rearma. Sem isto, o `StrictMode` do
      // React em desenvolvimento — e qualquer recarga do deck durante a
      // montagem — baixaria e decodificaria a biblioteca inteira de novo,
      // deixando duas decodificações concorrentes escrevendo no mesmo áudio.
      const existing = this.entries.get(asset.id)
      if (
        existing &&
        existing.asset.src === asset.src &&
        (existing.status.state === 'ready' || existing.status.state === 'arming')
      ) {
        existing.asset = asset
        continue
      }
      const entry: Entry = {
        asset,
        status: { state: 'arming', duration: asset.duration, strategy: null, error: null },
        buffer: null,
      }
      this.entries.set(asset.id, entry)
      pending.push(this.armOne(entry))
    }
    this.emit()
    await Promise.all(pending)
  }

  private async armOne(entry: Entry): Promise<void> {
    const { asset } = entry
    try {
      if (asset.duration > 0 && asset.duration <= LONG_AUDIO_SECONDS) {
        const ctx = this.context()
        const res = await fetch(asset.src)
        if (!res.ok) throw new Error(`o servidor respondeu ${res.status}`)
        // Servidor de desenvolvimento devolve a página inicial para caminhos que
        // não existem. Sem esta checagem o erro vira "formato não suportado" e
        // manda o operador procurar no lugar errado.
        const type = res.headers.get('content-type') ?? ''
        if (type.startsWith('text/') || type.includes('html')) {
          throw new Error('o arquivo não está no servidor')
        }
        const bytes = await res.arrayBuffer()
        const buffer = await ctx.decodeAudioData(bytes)
        entry.buffer = buffer
        entry.status = {
          state: 'ready',
          duration: buffer.duration,
          strategy: 'buffer',
          error: null,
        }
      } else {
        const duration = await preloadElement(asset.src)
        entry.status = { state: 'ready', duration, strategy: 'element', error: null }
      }
    } catch (err) {
      entry.status = {
        state: 'failed',
        duration: asset.duration,
        strategy: null,
        error: describe(err),
      }
    }
    this.emit()
  }

  /** Rearma só um áudio — o botão "tentar de novo" do estado de falha. */
  async rearm(audioId: string): Promise<void> {
    const entry = this.entries.get(audioId)
    if (!entry) return
    entry.status = {
      state: 'arming',
      duration: entry.asset.duration,
      strategy: null,
      error: null,
    }
    this.emit()
    await this.armOne(entry)
  }

  status(audioId: string): AssetStatus | null {
    return this.entries.get(audioId)?.status ?? null
  }

  /* ---------------- disparo ---------------- */

  /**
   * Dispara o cue. Disparos somam: disparar um cue já tocando abre uma segunda
   * voz do mesmo som — comportamento correto para efeitos curtos repetidos.
   */
  fire(cue: Cue, name: string): string | null {
    const entry = this.entries.get(cue.audioId)
    if (!entry || entry.status.state !== 'ready') return null

    const ctx = this.context()
    if (ctx.state !== 'running') void this.unlock()

    const gain = ctx.createGain()
    gain.connect(this.masterGain!)

    const id = `v${++voiceSeq}`
    const volume = cue.volume
    const now = ctx.currentTime

    const voice: LiveVoice = {
      id,
      cueId: cue.id,
      audioId: cue.audioId,
      name,
      duration: entry.status.duration,
      loop: cue.loop,
      volume,
      paused: false,
      gain,
      source: null,
      buffer: entry.buffer,
      element: null,
      mediaNode: null,
      startedAt: now,
      offset: 0,
      pausedAt: 0,
      ended: false,
    }

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + ATTACK)

    if (entry.status.strategy === 'buffer' && entry.buffer) {
      this.startBufferSource(voice, 0)
    } else {
      const el = new Audio(entry.asset.src)
      el.preload = 'auto'
      el.loop = cue.loop
      el.crossOrigin = 'anonymous'
      const media = ctx.createMediaElementSource(el)
      media.connect(gain)
      voice.element = el
      voice.mediaNode = media
      el.addEventListener('ended', () => this.finish(id))
      void el.play().catch(() => this.finish(id))
    }

    this.voices.set(id, voice)
    this.fired.add(cue.id)
    this.emit()
    return id
  }

  /**
   * `AudioBufferSourceNode` é descartável: cada retomada precisa de um nó novo,
   * começando no deslocamento guardado.
   */
  private startBufferSource(voice: LiveVoice, offset: number) {
    const ctx = this.context()
    const source = ctx.createBufferSource()
    source.buffer = voice.buffer
    source.loop = voice.loop
    source.connect(voice.gain)
    source.onended = () => {
      // Só encerra se este ainda for o nó vivo: trocar de nó ao pausar/reiniciar
      // também dispara `onended`, e ali a voz continua existindo.
      if (voice.source === source && !voice.paused) this.finish(voice.id)
    }
    source.start(0, offset)
    voice.source = source
    voice.startedAt = ctx.currentTime
    voice.offset = offset
  }

  /** Posição atual da voz, em segundos. Lida em rAF por quem desenha. */
  position(voiceId: string): number {
    const voice = this.voices.get(voiceId)
    if (!voice) return 0
    if (voice.paused) return voice.pausedAt
    if (voice.element) return voice.element.currentTime
    const ctx = this.ctx
    if (!ctx) return 0
    const elapsed = ctx.currentTime - voice.startedAt + voice.offset
    if (voice.loop && voice.duration > 0) return elapsed % voice.duration
    return Math.min(elapsed, voice.duration)
  }

  pause(voiceId: string) {
    const voice = this.voices.get(voiceId)
    if (!voice || voice.paused) return
    voice.pausedAt = this.position(voiceId)
    voice.paused = true
    if (voice.element) {
      voice.element.pause()
    } else if (voice.source) {
      const source = voice.source
      voice.source = null
      this.rampOut(voice.gain, source)
    }
    this.emit()
  }

  resume(voiceId: string) {
    const voice = this.voices.get(voiceId)
    if (!voice || !voice.paused) return
    voice.paused = false
    const ctx = this.context()
    const now = ctx.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(0, now)
    voice.gain.gain.linearRampToValueAtTime(voice.volume, now + ATTACK)
    if (voice.element) {
      void voice.element.play().catch(() => this.finish(voiceId))
    } else {
      this.startBufferSource(voice, voice.pausedAt)
    }
    this.emit()
  }

  restart(voiceId: string) {
    const voice = this.voices.get(voiceId)
    if (!voice) return
    const ctx = this.context()
    const now = ctx.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(0, now)
    voice.gain.gain.linearRampToValueAtTime(voice.volume, now + ATTACK)
    voice.paused = false
    voice.pausedAt = 0
    if (voice.element) {
      voice.element.currentTime = 0
      void voice.element.play().catch(() => this.finish(voiceId))
    } else {
      const old = voice.source
      voice.source = null
      if (old) {
        try {
          old.stop()
        } catch {
          /* já parado */
        }
      }
      this.startBufferSource(voice, 0)
    }
    this.emit()
  }

  /**
   * Leva a voz para um ponto qualquer do áudio — a barra arrastável e os
   * botões de dez segundos entram os dois por aqui.
   *
   * Pausado, só o deslocamento congelado se move: o som volta de onde o
   * operador deixou. Tocando, o nó de buffer é trocado por um novo no
   * deslocamento pedido, com o mesmo cuidado do reinício — o ganho vai a zero
   * antes de o nó antigo ser solto, porque cortar a onda no meio estala.
   */
  seek(voiceId: string, seconds: number) {
    const voice = this.voices.get(voiceId)
    if (!voice || voice.ended) return
    const target = wrap(seconds, voice.duration, voice.loop)

    if (voice.element) {
      try {
        voice.element.currentTime = target
      } catch {
        /* trecho ainda não baixado; a posição atual continua valendo */
      }
      if (voice.paused) voice.pausedAt = target
    } else if (voice.paused) {
      voice.pausedAt = target
    } else {
      const ctx = this.context()
      const now = ctx.currentTime
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(0, now)
      voice.gain.gain.linearRampToValueAtTime(voice.volume, now + ATTACK)
      const old = voice.source
      // Zerado antes de parar o antigo: assim o `onended` dele reconhece que
      // já não é o nó vivo e não encerra a voz inteira.
      voice.source = null
      if (old) {
        try {
          old.stop()
        } catch {
          /* já parado */
        }
      }
      this.startBufferSource(voice, target)
    }
    this.emit()
  }

  /** Salto relativo à posição atual: `-10` volta, `+10` avança. */
  nudge(voiceId: string, delta: number) {
    if (!this.voices.has(voiceId)) return
    this.seek(voiceId, this.position(voiceId) + delta)
  }

  stop(voiceId: string) {
    const voice = this.voices.get(voiceId)
    if (!voice || voice.ended) return
    voice.ended = true
    if (voice.element) {
      this.rampOut(voice.gain, null, () => {
        voice.element?.pause()
        voice.mediaNode?.disconnect()
      })
    } else {
      const source = voice.source
      voice.source = null
      this.rampOut(voice.gain, source)
    }
    this.voices.delete(voiceId)
    this.emit()
  }

  stopAll() {
    for (const id of [...this.voices.keys()]) this.stop(id)
  }

  /** `ESPAÇO`: congela ou solta tudo de uma vez, sem perder posição. */
  togglePauseAll() {
    const anyPlaying = [...this.voices.values()].some((v) => !v.paused)
    if (anyPlaying) {
      for (const id of this.voices.keys()) this.pause(id)
    } else {
      for (const id of this.voices.keys()) this.resume(id)
    }
    this.emit()
  }

  setVoiceVolume(voiceId: string, volume: number) {
    const voice = this.voices.get(voiceId)
    if (!voice) return
    voice.volume = volume
    if (!voice.paused && this.ctx) {
      voice.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01)
    }
    this.emit()
  }

  setVoiceLoop(voiceId: string, loop: boolean) {
    const voice = this.voices.get(voiceId)
    if (!voice) return
    voice.loop = loop
    if (voice.element) voice.element.loop = loop
    else if (voice.source) voice.source.loop = loop
    this.emit()
  }

  setMaster(volume: number) {
    this.master = volume
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01)
    }
    this.emit()
  }

  getMaster(): number {
    return this.master
  }

  /** Cues já disparados nesta sessão. Orientação no roteiro sem impor ordem. */
  clearFired() {
    this.fired.clear()
    this.emit()
  }

  private finish(voiceId: string) {
    const voice = this.voices.get(voiceId)
    if (!voice) return
    voice.ended = true
    voice.mediaNode?.disconnect()
    voice.gain.disconnect()
    this.voices.delete(voiceId)
    this.emit()
  }

  /** Desce o ganho em 15ms antes de soltar o nó — sem isso, estala. */
  private rampOut(gain: GainNode, source: AudioBufferSourceNode | null, after?: () => void) {
    const ctx = this.ctx
    if (!ctx) {
      after?.()
      return
    }
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + RAMP)
    if (source) {
      try {
        source.stop(now + RAMP + 0.005)
      } catch {
        /* já parado */
      }
    }
    window.setTimeout(
      () => {
        after?.()
        gain.disconnect()
      },
      (RAMP + 0.02) * 1000,
    )
  }

  /* ---------------- assinatura ---------------- */

  subscribe = (listener: EngineListener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Snapshots estáveis entre mudanças — exigência do `useSyncExternalStore`. */
  getVoices = (): Voice[] => this.voicesSnapshot
  getStatuses = (): Record<string, AssetStatus> => this.statusSnapshot
  getFired = (): ReadonlySet<string> => this.firedSnapshot

  private emit() {
    this.voicesSnapshot = [...this.voices.values()].map((v) => ({
      id: v.id,
      cueId: v.cueId,
      audioId: v.audioId,
      name: v.name,
      duration: v.duration,
      loop: v.loop,
      volume: v.volume,
      paused: v.paused,
    }))
    const statuses: Record<string, AssetStatus> = {}
    for (const [id, entry] of this.entries) statuses[id] = entry.status
    this.statusSnapshot = statuses
    this.firedSnapshot = new Set(this.fired)
    for (const listener of this.listeners) listener()
  }
}

/**
 * Baixa o suficiente para tocar sem engasgo e devolve a duração real.
 * `canplaythrough` é o sinal desejado, mas alguns navegadores só o emitem
 * depois de um play — daí a corrida com `loadedmetadata` + tempo limite.
 */
function preloadElement(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = new Audio()
    el.preload = 'auto'
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      fn()
    }
    el.addEventListener('canplaythrough', () => done(() => resolve(el.duration)))
    el.addEventListener('error', () =>
      done(() => reject(new Error('o arquivo não pôde ser lido'))),
    )
    el.addEventListener('loadedmetadata', () => {
      // Metadados chegaram: já sabemos a duração. Damos mais um tempo para o
      // buffer encher, mas não travamos a abertura por causa disso.
      window.clearTimeout(timer)
      timer = window.setTimeout(() => done(() => resolve(el.duration)), 4000)
    })
    let timer = window.setTimeout(
      () => done(() => reject(new Error('tempo esgotado ao carregar'))),
      15000,
    )
    el.src = src
    el.load()
  })
}

/**
 * Prende a posição ao trecho que existe. Em loop não há começo nem fim: recuar
 * antes do zero cai no final do áudio, que é o que o operador ouviria mesmo.
 */
function wrap(seconds: number, duration: number, loop: boolean): number {
  if (!Number.isFinite(seconds)) return 0
  if (duration <= 0) return Math.max(0, seconds)
  if (loop) return ((seconds % duration) + duration) % duration
  return Math.min(Math.max(0, seconds), duration)
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'EncodingError' || /decod/i.test(err.message)) {
      return 'formato não suportado por este navegador'
    }
    return err.message
  }
  return 'falha desconhecida'
}

export const engine = new AudioEngine()
